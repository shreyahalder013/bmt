'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ImageSlotKey, getSlotConfig, getAllSlots, formatFileSize, formatAspectRatio } from '@/lib/image-slots';

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  focalX?: number;
  focalY?: number;
}

interface FocalPoint {
  x: number;
  y: number;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  slot: string;
  crop: CropData | null;
  focalPoint: { x: number; y: number } | null;
  altText: string;
  caption: string;
  isDecorative: boolean;
  consentGranted: boolean;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error' | 'warning';
  error?: string;
  warning?: string;
  qualityNote?: 'good' | 'ok' | 'low';
  progress: number;
  jobId?: string;
  assetId?: string;
  variants?: Array<{ width: number; height: number; format: string; url: string; size: number }>;
}

const SLOTS = Object.entries(getAllSlots()).filter(s => s[1].category !== 'thumbnail');

function MediaUploader() {
  const [activeSlot, setActiveSlot] = useState<string>('faculty');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCropper, setShowCropper] = useState<string | null>(null);
  const [cropperData, setCropperData] = useState<{ image: UploadedImage; imgRef: HTMLImageElement | null } | null>(null);
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const slotConfig = getSlotConfig(activeSlot as any);

  // Handle file selection
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxFiles = activeSlot === 'gallery' ? 50 : 1;

    if (fileArray.length > maxFiles) {
      showMessage(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed for this slot.`, 'error');
      return;
    }

    for (const file of fileArray) {
      // We accept ALL files - server will validate by magic bytes
      // Just check for obviously dangerous extensions
      const dangerousExts = ['exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'js', 'jar', 'sh', 'py', 'rb', 'pl', 'php', 'asp', 'aspx', 'jsp', 'html', 'htm', 'xml', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dll', 'so', 'dylib', 'bin', 'app', 'deb', 'rpm', 'apk', 'ipa'];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && dangerousExts.includes(ext)) {
        showMessage(`${file.name}: This file can't be used as a photo. Please upload a JPG, PNG, HEIC, WebP or PDF.`, 'error');
        continue;
      }

      // Check file size (50 MB)
      if (file.size > 50 * 1024 * 1024) {
        showMessage(`${file.name}: File too large (${formatFileSize(file.size)}). Maximum 50 MB.`, 'error');
        continue;
      }

      // Create preview
      const preview = URL.createObjectURL(file);

      const newImage: UploadedImage = {
        id: crypto.randomUUID(),
        file,
        preview,
        slot: activeSlot,
        crop: null,
        focalPoint: null,
        altText: '',
        caption: '',
        isDecorative: false,
        consentGranted: !slotConfig.requiresConsent,
        status: 'pending',
        progress: 0,
      };

      setImages(prev => [...prev, newImage]);
    }
  }, [activeSlot, slotConfig]);

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // Handle camera capture
  const handleCameraCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise(resolve => video.onloadeddata = resolve);

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      stream.getTracks().forEach(track => track.stop());

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
      });

      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleFiles([file]);
      }
    } catch (err) {
      showMessage('Camera access denied or not available.', 'error');
    }
  }, [handleFiles]);

  // Handle paste from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFiles([file]);
        }
      }
    }
  }, [handleFiles]);

  // Start polling for job progress
  const startPolling = useCallback((imageId: string, jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/media/job?jobId=${jobId}`);
        if (!res.ok) return;

        const data = await res.json();
        const job = data.job;
        const asset = data.asset;

        setImages(prev => prev.map(img => {
          if (img.id !== imageId) return img;

          if (job.state === 'completed') {
            return {
              ...img,
              status: 'success',
              progress: 100,
              assetId: asset?.id,
              variants: asset?.variants,
              warning: asset ? undefined : img.warning,
            };
          } else if (job.state === 'failed') {
            return {
              ...img,
              status: 'error',
              error: job.failedReason || 'Processing failed',
              progress: 0,
            };
          } else if (job.state === 'active' || job.state === 'waiting') {
            return {
              ...img,
              status: 'processing',
              progress: job.progress,
            };
          }
          return img;
        }));

        // Stop polling if completed or failed
        if (job.state === 'completed' || job.state === 'failed') {
          const interval = pollingRef.current.get(imageId);
          if (interval) {
            clearInterval(interval);
            pollingRef.current.delete(imageId);
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Poll every 1 second
    const interval = setInterval(poll, 1000);
    pollingRef.current.set(imageId, interval);

    // Also poll immediately
    poll();
  }, []);

  // Upload single image
  const uploadImage = useCallback(async (image: UploadedImage) => {
    setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'uploading', progress: 0 } : img));

    const formData = new FormData();
    formData.append('file', image.file);
    formData.append('slot', image.slot);
    formData.append('altText', image.altText);
    formData.append('caption', image.caption);
    formData.append('isDecorative', String(image.isDecorative));
    formData.append('consentGranted', String(image.consentGranted));

    if (image.crop) {
      formData.append('cropData', JSON.stringify(image.crop));
    }
    if (image.focalPoint) {
      formData.append('focalPoint', JSON.stringify(image.focalPoint));
    }

    try {
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setImages(prev => prev.map(img =>
          img.id === image.id ? { ...img, status: 'error', error: result.error, progress: 0 } : img
        ));
        return;
      }

      // Update with job info and start polling
      setImages(prev => prev.map(img =>
        img.id === image.id
          ? { ...img, status: 'processing', progress: 10, jobId: result.jobId, assetId: result.asset.id }
          : img
      ));

      // Start polling for progress
      if (result.jobId) {
        startPolling(image.id, result.jobId);
      }

      showMessage(`${image.file.name} uploaded! Processing...`, 'info');
    } catch (err) {
      setImages(prev => prev.map(img =>
        img.id === image.id ? { ...img, status: 'error', error: 'Upload failed', progress: 0 } : img
      ));
    }
  }, [startPolling]);

  // Upload all images
  const uploadAll = useCallback(async () => {
    for (const image of images) {
      if (image.status === 'pending') {
        await uploadImage(image);
      }
    }
  }, [images, uploadImage]);

  // Open cropper
  const openCropper = useCallback((image: UploadedImage) => {
    setShowCropper(image.id);
  }, []);

  // Handle crop completion
  const handleCropComplete = useCallback((crop: CropData) => {
    if (!cropperData) return;

    setImages(prev => prev.map(img =>
      img.id === cropperData.image.id
        ? { ...img, crop: { ...crop, x: Math.round(crop.x), y: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) } }
        : img
    ));
    closeCropper();
  }, [cropperData]);

  const closeCropper = useCallback(() => {
    setShowCropper(null);
    setCropperData(null);
  }, []);

  // Handle focal point selection
  const handleFocalPoint = useCallback((imageId: string, x: number, y: number) => {
    setImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, focalPoint: { x, y } } : img
    ));
  }, []);

  // Remove image
  const removeImage = useCallback((id: string) => {
    // Stop any polling
    const interval = pollingRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollingRef.current.delete(id);
    }

    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  // Retry failed upload
  const retryUpload = useCallback((image: UploadedImage) => {
    uploadImage(image);
  }, [uploadImage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview));
      pollingRef.current.forEach(interval => clearInterval(interval));
      pollingRef.current.clear();
    };
  }, [images]);

  // Handle paste globally
  useEffect(() => {
    const handlePasteGlobal = (e: ClipboardEvent) => {
      // Only handle paste when uploader is focused or no input focused
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      handlePaste(e as unknown as React.ClipboardEvent<Element>);
    };
    document.addEventListener('paste', handlePasteGlobal);
    return () => document.removeEventListener('paste', handlePasteGlobal);
  }, [handlePaste]);

  return (
    <div className="media-uploader">
      {/* Slot Selector */}
      <div className="slot-selector">
        <label className="slot-label">Image Type</label>
        <div className="slot-tabs" role="tablist">
          {SLOTS.map(([key, config]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeSlot === key}
              className={`slot-tab ${activeSlot === key ? 'active' : ''}`}
              onClick={() => { setActiveSlot(key); setImages([]); }}
            >
              <span className="slot-icon" style={{ backgroundColor: config.placeholderColor }}>
                {config.placeholderText.charAt(0)}
              </span>
              <span className="slot-name">{config.label}</span>
            </button>
          ))}
        </div>
        <p className="slot-description">{slotConfig.description}</p>
      </div>

      {/* Slot Requirements */}
      <div className="slot-requirements">
        <div className="requirement-item">
          <span className="req-label">Required Ratio</span>
          <span className="req-value">{formatAspectRatio(slotConfig.aspectRatio)}</span>
        </div>
        <div className="requirement-item">
          <span className="req-label">Recommended</span>
          <span className="req-value">{slotConfig.suggestedWidth}×{slotConfig.suggestedHeight}px</span>
        </div>
        <div className="requirement-item">
          <span className="req-label">Max File Size</span>
          <span className="req-value">{formatFileSize(slotConfig.maxFileSize)}</span>
        </div>
        <div className="requirement-item">
          <span className="req-label">Formats</span>
          <span className="req-value">JPG, PNG, WebP, AVIF, HEIC, GIF, BMP, TIFF, PDF, RAW, SVG (logos)</span>
        </div>
        {slotConfig.requiresConsent && (
          <div className="requirement-item consent-warning">
            ⚠ Consent required for this slot (photos of minors)
          </div>
        )}
        <div className="requirement-item info-hint">
          💡 Any size, any ratio, any format — we handle the rest automatically.
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onPaste={handlePaste}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.svg"
          multiple={activeSlot === 'gallery'}
          onChange={e => e.target.files && handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="upload-text">Drag & drop, paste, or click to select {activeSlot === 'gallery' ? 'up to 50 images' : 'an image'}</p>
        <p className="upload-hint">Supports: JPG, PNG, WebP, AVIF, HEIC, GIF, BMP, TIFF, PDF, RAW (CR2, NEF, ARW, DNG) • Max 50 MB</p>
        <div className="upload-actions">
          <button type="button" className="btn-camera" onClick={handleCameraCapture} disabled={activeSlot === 'gallery'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
            <span>Take Photo</span>
          </button>
        </div>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="image-previews">
          {images.map(image => (
            <div key={image.id} className={`image-preview ${image.status}`}>
              <div className="preview-image-wrapper">
                <img src={image.preview} alt="Preview" />
                {image.crop && (
                  <div className="crop-indicator">Cropped</div>
                )}
                {image.focalPoint && (
                  <div className="focal-indicator" style={{ left: `${image.focalPoint.x * 100}%`, top: `${image.focalPoint.y * 100}%` }} />
                )}
                {(image.status === 'uploading' || image.status === 'processing') && (
                  <div className="upload-progress-overlay">
                    <div className="progress-bar" style={{ width: `${image.progress}%` }} />
                    <span>{image.status === 'processing' ? `Processing ${image.progress}%` : `${image.progress}%`}</span>
                  </div>
                )}
                {image.status === 'error' && (
                  <div className="error-overlay">
                    <span>{image.error}</span>
                  </div>
                )}
                {image.status === 'warning' && (
                  <div className="warning-overlay">
                    <span>⚠ {image.warning}</span>
                  </div>
                )}
              </div>
              <div className="image-details">
                <div className="detail-row">
                  <label>Alt Text <span className="required">*</span></label>
                  <input
                    type="text"
                    value={image.altText}
                    onChange={e => setImages(prev => prev.map(img => img.id === image.id ? { ...img, altText: e.target.value } : img))}
                    placeholder={slotConfig.altSuggestion || 'Describe the image...'}
                    required={slotConfig.altRequired && !image.isDecorative}
                    disabled={image.status === 'uploading' || image.status === 'processing' || image.status === 'success'}
                  />
                </div>
                <div className="detail-row">
                  <label>Caption (optional)</label>
                  <input
                    type="text"
                    value={image.caption}
                    onChange={e => setImages(prev => prev.map(img => img.id === image.id ? { ...img, caption: e.target.value } : img))}
                    placeholder="Brief description..."
                    disabled={image.status === 'uploading' || image.status === 'processing' || image.status === 'success'}
                  />
                </div>
                {slotConfig.requiresConsent && (
                  <label className="consent-checkbox">
                    <input
                      type="checkbox"
                      checked={image.consentGranted}
                      onChange={e => setImages(prev => prev.map(img => img.id === image.id ? { ...img, consentGranted: e.target.checked } : img))}
                      disabled={image.status === 'uploading' || image.status === 'processing' || image.status === 'success'}
                    />
                    <span>I have the parent/guardian's permission to publish this photo of a minor</span>
                  </label>
                )}
                <label className="decorative-checkbox">
                  <input
                    type="checkbox"
                    checked={image.isDecorative}
                    onChange={e => setImages(prev => prev.map(img => img.id === image.id ? { ...img, isDecorative: e.target.checked, altText: e.target.checked ? '' : img.altText } : img))}
                    disabled={image.status === 'uploading' || image.status === 'processing' || image.status === 'success'}
                  />
                  <span>Decorative image (no alt text needed)</span>
                </label>
              </div>
              <div className="image-actions">
                {slotConfig.cropMode === 'forced' && (image.status === 'pending' || image.status === 'warning') && (
                  <button type="button" className="btn-crop" onClick={() => { openCropper(image); setCropperData({ image, imgRef: null }); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h12"/><path d="M1 6.13L16 6"/><path d="M3 5l6 6"/></svg>
                    Crop / Focal Point
                  </button>
                )}
                {image.assetId && image.status === 'success' && (
                  <button type="button" className="btn-adjust" onClick={() => { openCropper(image); setCropperData({ image, imgRef: null }); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Adjust
                  </button>
                )}
                <button
                  type="button"
                  className={`btn-upload ${image.status === 'uploading' || image.status === 'processing' ? 'loading' : ''} ${image.status === 'success' ? 'success' : ''}`}
                  onClick={() => uploadImage(image)}
                  disabled={image.status === 'uploading' || image.status === 'processing' || image.status === 'success'}
                >
                  {image.status === 'success' ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      Done
                    </>
                  ) : image.status === 'error' ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Retry
                    </>
                  ) : image.status === 'processing' ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Upload
                    </>
                  )}
                </button>
                {image.status !== 'uploading' && image.status !== 'processing' && image.status !== 'success' && (
                  <button type="button" className="btn-remove" onClick={() => removeImage(image.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </div>
              {(image.status === 'error' && image.error) && (
                <div className="error-message">{image.error}</div>
              )}
              {(image.status === 'warning' && image.warning) && (
                <div className="warning-message">⚠ {image.warning}</div>
              )}
              {image.qualityNote && image.qualityNote !== 'good' && (
                <div className={`quality-note ${image.qualityNote}`}>
                  {image.qualityNote === 'ok' ? '📷 Good quality - may look slightly soft on large screens' :
                   image.qualityNote === 'low' ? '📷 Low resolution - best used at small sizes' : ''}
                </div>
              )}
            </div>
          ))}
          {images.length === 0 && (
            <div className="no-images-hint">
              <p>No images added yet. Drop files above, click to browse, paste from clipboard, or take a photo.</p>
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions */}
      {images.some(i => i.status === 'pending') && (
        <div className="bulk-actions">
          <button className="btn-primary" onClick={uploadAll} disabled={images.every(i => i.status !== 'pending')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload All ({images.filter(i => i.status === 'pending').length})
          </button>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`toast ${message.type}`} role="alert">
          {message.text}
        </div>
      )}

      {/* Cropper Modal */}
      {showCropper && cropperData && (
        <CropperModal
          image={cropperData.image}
          imgRef={cropperData.imgRef}
          slotConfig={slotConfig}
          onComplete={handleCropComplete}
          onCancel={closeCropper}
          onFocalPoint={handleFocalPoint}
          setImgRef={(ref: HTMLImageElement | null) => setCropperData(prev => prev ? { ...prev, imgRef: ref } : null)}
        />
      )}
    </div>
  );
}

// Cropper Modal Component
function CropperModal({
  image,
  imgRef,
  slotConfig,
  onComplete,
  onCancel,
  onFocalPoint,
  setImgRef,
}: {
  image: UploadedImage;
  imgRef: HTMLImageElement | null;
  slotConfig: any;
  onComplete: (crop: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
  onFocalPoint: (imageId: string, x: number, y: number) => void;
  setImgRef: (ref: HTMLImageElement | null) => void;
}) {
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(image.crop);
  const [focalPoint, setFocalPoint] = useState<{ x: number; y: number } | null>(image.focalPoint);
  const [showFocalPoint, setShowFocalPoint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const aspectRatio = slotConfig.aspectRatio.width / slotConfig.aspectRatio.height;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgRef(e.currentTarget);
    if (!crop) {
      const { width, height } = e.currentTarget;
      const imgAspect = width / height;
      let cropWidth, cropHeight, cropX, cropY;

      if (imgAspect > aspectRatio) {
        cropHeight = height;
        cropWidth = height * aspectRatio;
        cropX = (width - cropWidth) / 2;
        cropY = 0;
      } else {
        cropWidth = width;
        cropHeight = width / aspectRatio;
        cropX = 0;
        cropY = (height - cropHeight) / 2;
      }
      setCrop({ x: cropX, y: cropY, width: cropWidth, height: cropHeight });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showFocalPoint) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const clampedX = Math.max(0, Math.min(1, x));
        const clampedY = Math.max(0, Math.min(1, y));
        setFocalPoint({ x: clampedX, y: clampedY });
        onFocalPoint(image.id, clampedX, clampedY);
      }
    }
  };

  return (
    <div className="cropper-modal-overlay" onClick={onCancel}>
      <div className="cropper-modal" onClick={e => e.stopPropagation()}>
        <div className="cropper-header">
          <h3>Crop & Focal Point</h3>
          <p className="cropper-instructions">
            Drag to adjust crop area. <strong>Click "Set Focal Point"</strong> then click on the image to set the focus point for responsive cropping.
          </p>
        </div>
        <div className="cropper-body">
          <div className="cropper-controls">
            <label className="toggle-focal">
              <input
                type="checkbox"
                checked={showFocalPoint}
                onChange={e => setShowFocalPoint(e.target.checked)}
              />
              <span>Set Focal Point (click on image)</span>
            </label>
            <div className="cropper-aspect-info">
              Aspect Ratio: {formatAspectRatio(slotConfig.aspectRatio)} ({slotConfig.aspectRatio.width}:{slotConfig.aspectRatio.height})
            </div>
          </div>
          <div className="cropper-preview-container" ref={containerRef} onMouseDown={handleMouseDown}>
            <img
              src={image.preview}
              alt="Crop preview"
              onLoad={handleImageLoad}
              style={{
                width: '100%',
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
            {crop && (
              <div
                className="crop-overlay"
                style={{
                  left: `${(crop.x / (imgRef?.width || 1)) * 100}%`,
                  top: `${(crop.y / (imgRef?.height || 1)) * 100}%`,
                  width: `${(crop.width / (imgRef?.width || 1)) * 100}%`,
                  height: `${(crop.height / (imgRef?.height || 1)) * 100}%`,
                }}
              />
            )}
            {focalPoint && (
              <div
                className="focal-point-marker"
                style={{
                  left: `${focalPoint.x * 100}%`,
                  top: `${focalPoint.y * 100}%`,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
            )}
          </div>
          <div className="cropper-preview">
            <h4>Preview</h4>
            <div className="preview-box" style={{ aspectRatio: `${slotConfig.aspectRatio.width} / ${slotConfig.aspectRatio.height}` }}>
              {imgRef && crop && (
                <img
                  src={image.preview}
                  alt="Cropped preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${(crop.x + crop.width / 2) / (imgRef.width || 1) * 100}% ${(crop.y + crop.height / 2) / (imgRef.height || 1) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <div className="cropper-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => crop && onComplete(crop)} disabled={!crop}>
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}

export default MediaUploader;