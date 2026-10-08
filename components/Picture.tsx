'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

export interface MediaVariant {
  width: number;
  height: number;
  format: string;
  url: string;
  size: number;
}

export interface MediaAsset {
  id: string;
  slot: string;
  altText: string | null;
  caption: string | null;
  isDecorative: boolean;
  blurDataURL: string | null;
  dominantColor: string | null;
  focalX: number | null;
  focalY: number | null;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  variants: MediaVariant[];
}

interface PictureProps {
  asset: MediaAsset;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
}

export function getBestVariant(asset: MediaAsset, targetWidth: number, preferredFormat: 'avif' | 'webp' | 'jpeg' = 'avif'): MediaVariant | null {
  const variants = asset.variants.filter(v => v.format === preferredFormat && v.width <= targetWidth);
  if (variants.length === 0) return null;
  return variants.reduce((best, current) =>
    Math.abs(current.width - targetWidth) < Math.abs(best.width - targetWidth) ? current : best
  );
}

export function getSrcSet(asset: MediaAsset, format: 'avif' | 'webp' | 'jpeg'): string {
  const variants = asset.variants
    .filter(v => v.format === format)
    .sort((a, b) => a.width - b.width);

  if (variants.length === 0) return '';

  return variants.map(v => `${v.url} ${v.width}w`).join(', ');
}

export function getSizes(slot: string): string {
  const sizesMap: Record<string, string> = {
    hero: '100vw',
    about: '(max-width: 768px) 100vw, 50vw',
    faculty: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
    gallery: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    'gallery-thumbnail': '(max-width: 640px) 80px, 120px',
    'testimonial-avatar': '60px',
    result: '(max-width: 768px) 100vw, 50vw',
    'event-banner': '100vw',
    'og-image': '1200px',
    logo: '120px',
    favicon: '32px',
  };
  return sizesMap[slot] || '100vw';
}

export function getObjectPosition(asset: MediaAsset): string {
  if (asset.focalX !== null && asset.focalY !== null) {
    return `${Math.round(asset.focalX * 100)}% ${Math.round(asset.focalY * 100)}%`;
  }
  return 'center';
}

export function Picture({
  asset,
  className = '',
  priority = false,
  fill = false,
  sizes,
  style,
  onLoad,
  onError,
}: PictureProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const isLogo = asset.slot === 'LOGO' || asset.slot === 'FAVICON';
  const isBanner = ['HERO', 'ABOUT', 'EVENT_BANNER', 'OG_IMAGE'].includes(asset.slot);
  const isGallery = asset.slot === 'GALLERY';

  const objectFit = isLogo ? 'contain' : 'cover';
  const objectPosition = getObjectPosition(asset);

  // Determine best format based on browser support
  // We'll use multiple source elements for different formats
  const avifSrcSet = getSrcSet(asset, 'avif');
  const webpSrcSet = getSrcSet(asset, 'webp');
  const jpegSrcSet = getSrcSet(asset, 'jpeg');

  const src = asset.variants.find(v => v.format === 'jpeg' && v.width <= 800)?.url ||
    asset.variants.find(v => v.format === 'webp' && v.width <= 800)?.url ||
    asset.variants[0]?.url;

  if (!src) {
    // Return placeholder if no variants
    return (
      <div
        className={`picture-placeholder ${className}`}
        style={{
          ...style,
          backgroundColor: asset.dominantColor || '#888',
          aspectRatio: asset.slot === 'GALLERY' ? 'auto' : undefined,
        }}
        role="img"
        aria-label={asset.altText || 'Image'}
      >
        {asset.altText && !asset.isDecorative && (
          <span className="placeholder-text">{asset.altText}</span>
        )}
      </div>
    );
  }

  const computedSizes = sizes || getSizes(asset.slot);

  return (
    <div
      className={`picture-wrapper ${className} ${loaded ? 'loaded' : 'loading'} ${failed ? 'failed' : ''}`}
      style={{
        ...style,
        position: fill ? 'absolute' : 'relative',
        width: fill ? '100%' : undefined,
        height: fill ? '100%' : undefined,
        overflow: 'hidden',
      }}
    >
      {/* Blur placeholder */}
      {(asset.blurDataURL || asset.dominantColor) && !loaded && !failed && (
        <div
          className="blur-placeholder"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundSize: 'cover',
            backgroundPosition: objectPosition,
            backgroundImage: asset.blurDataURL ? `url("${asset.blurDataURL}")` : undefined,
            backgroundColor: asset.dominantColor || undefined,
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            transition: 'opacity 0.3s ease-out',
            opacity: loaded || failed ? 0 : 1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      <picture>
        {avifSrcSet && (
          <source
            type="image/avif"
            srcSet={avifSrcSet}
            sizes={computedSizes}
          />
        )}
        {webpSrcSet && (
          <source
            type="image/webp"
            srcSet={webpSrcSet}
            sizes={computedSizes}
          />
        )}
        {jpegSrcSet && (
          <source
            type="image/jpeg"
            srcSet={jpegSrcSet}
            sizes={computedSizes}
          />
        )}
        <Image
          src={src}
          alt={asset.isDecorative ? '' : (asset.altText || '')}
          fill={fill}
          priority={priority}
          sizes={computedSizes}
          style={{
            objectFit,
            objectPosition,
            opacity: loaded || failed ? 1 : 0,
            transition: 'opacity 0.4s ease-out',
            width: '100%',
            height: '100%',
          }}
          onLoad={() => {
            setLoaded(true);
            onLoad?.();
          }}
          onError={() => {
            setFailed(true);
            onError?.();
          }}
          placeholder="blur"
          blurDataURL={asset.blurDataURL || undefined}
        />
      </picture>

      {failed && (
        <div className="image-error-fallback" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: asset.dominantColor || '#888' }}>
          <div className="error-content" role="alert">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p>Failed to load image</p>
            <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
          </div>
        </div>
      )}

      {asset.caption && !asset.isDecorative && (
        <figcaption className="image-caption">{asset.caption}</figcaption>
      )}
    </div>
  );
}

// Hero image component with priority loading
export function HeroImage({ asset }: { asset: MediaAsset }) {
  return (
    <Picture
      asset={asset}
      priority={true}
      fill={false}
      sizes="100vw"
      className="hero-image"
      style={{ width: '100%', aspectRatio: '4 / 3' }}
    />
  );
}

// Faculty card image
export function FacultyImage({ asset }: { asset: MediaAsset }) {
  return (
    <Picture
      asset={asset}
      fill={true}
      className="faculty-image"
      style={{ aspectRatio: '4 / 5' }}
    />
  );
}

// Gallery item image
export function GalleryImage({ asset, onClick }: { asset: MediaAsset; onClick?: () => void }) {
  return (
    <div className="gallery-item" onClick={onClick}>
      <Picture
        asset={asset}
        fill={true}
        className="gallery-image"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
      {asset.caption && <figcaption className="gallery-caption">{asset.caption}</figcaption>}
    </div>
  );
}

// Gallery lightbox component
export function GalleryLightbox({
  assets,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  assets: MediaAsset[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const asset = assets[currentIndex];
  const [loaded, setLoaded] = useState(false);

  if (!asset) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Image gallery">
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <button
          className="lightbox-close"
          onClick={onClose}
          aria-label="Close gallery"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <button
          className="lightbox-nav prev"
          onClick={onPrev}
          aria-label="Previous image"
          disabled={currentIndex === 0}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          className="lightbox-nav next"
          onClick={onNext}
          aria-label="Next image"
          disabled={currentIndex === assets.length - 1}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div className="lightbox-image-container">
          {asset.variants.length > 0 && (
            <Image
              src={asset.variants.find(v => v.format === 'avif')?.url || asset.variants[0]?.url}
              alt={asset.isDecorative ? '' : (asset.altText || '')}
              fill
              priority
              sizes="100vw"
              style={{
                objectFit: 'contain',
                objectPosition: getObjectPosition(asset),
                opacity: loaded ? 1 : 0,
                transition: 'opacity 0.3s ease-out',
              }}
              onLoad={() => setLoaded(true)}
              placeholder="blur"
              blurDataURL={asset.blurDataURL || undefined}
            />
          )}
          {!loaded && asset.blurDataURL && (
            <div className="lightbox-blur" style={{ backgroundImage: `url("${asset.blurDataURL}")` }} />
          )}
        </div>

        {(asset.caption || asset.altText) && (
          <div className="lightbox-caption">
            {asset.caption && <p className="caption-text">{asset.caption}</p>}
            {asset.altText && !asset.caption && <p className="alt-text">{asset.altText}</p>}
            <p className="image-counter">{currentIndex + 1} / {assets.length}</p>
          </div>
        )}
      </div>
    </div>
  );
}