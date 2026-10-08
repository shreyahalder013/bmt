import sharp, { 
  FormatEnum, 
  AvailableFormatInfo,
  JpegOptions,
  WebpOptions,
  AvifOptions,
  Sharp 
} from 'sharp';
import { readFile } from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import { parse as parseExif } from 'exif-parser';
import { encode as blurhashEncode } from 'blurhash';
import { ImageSlotKey, ImageSlotConfig, getSlotConfig, formatAspectRatio, calculateDimensions } from '@/lib/image-slots';

// Type declaration for exif-parser
declare module 'exif-parser' {
  export function parse(buffer: Buffer): {
    tags: Record<string, any>;
  };
}

type SharpFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff' | 'gif' | 'heif' | 'jp2' | 'jxl' | 'raw';
type SharpOptions = JpegOptions | WebpOptions | AvifOptions;

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
  blurDataURL: string;
  dominantColor: string;
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  focalX?: number;
  focalY?: number;
}

export interface ProcessingOptions {
  slot: ImageSlotKey;
  crop?: CropData;
  focalPoint?: { x: number; y: number };
  generateVariants?: boolean;
  backgroundColor?: string; // For transparency flattening
  isLogo?: boolean; // Keep transparency for logos
}

export interface VariantInfo {
  width: number;
  height: number;
  format: string;
  buffer: Buffer;
  size: number;
  blurDataURL?: string;
}

export interface ProcessingResult {
  original: ProcessedImage;
  variants: VariantInfo[];
  cropData: CropData | null;
  warnings: string[];
  qualityNote: 'good' | 'ok' | 'low';
  faceDetected: boolean;
  faceArea?: { x: number; y: number; width: number; height: number };
}

const VARIANT_WIDTHS = [320, 480, 640, 960, 1280, 1600, 1920];
const VARIANT_FORMATS = ['avif', 'webp', 'jpeg'] as const;
const MAX_DIMENSION = 5000; // Allow up to 5000px for large source images
const MAX_PIXELS = 100_000_000; // 100 megapixels
const PLACEHOLDER_WIDTH = 20;
const PLACEHOLDER_HEIGHT = 20;
const BLURHASH_COMPONENTS = { x: 4, y: 4 };

// Size budgets per slot (in bytes)
const SIZE_BUDGETS: Record<ImageSlotKey, Record<string, number>> = {
  hero: { mobile: 150 * 1024, desktop: 300 * 1024 },
  about: { mobile: 120 * 1024, desktop: 250 * 1024 },
  faculty: { mobile: 60 * 1024, desktop: 100 * 1024 },
  gallery: { mobile: 100 * 1024, desktop: 200 * 1024 },
  'gallery-thumbnail': { mobile: 40 * 1024, desktop: 60 * 1024 },
  'testimonial-avatar': { mobile: 30 * 1024, desktop: 50 * 1024 },
  result: { mobile: 100 * 1024, desktop: 200 * 1024 },
  'event-banner': { mobile: 150 * 1024, desktop: 300 * 1024 },
  'og-image': { mobile: 100 * 1024, desktop: 200 * 1024 },
  logo: { mobile: 50 * 1024, desktop: 100 * 1024 },
  favicon: { mobile: 20 * 1024, desktop: 30 * 1024 },
};

// Accepted MIME types with their extensions
const ACCEPTED_MIMES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg', 'jfif'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'image/heic': ['heic', 'heif'],
  'image/heif': ['heic', 'heif'],
  'image/gif': ['gif'],
  'image/bmp': ['bmp'],
  'image/tiff': ['tiff', 'tif'],
  'image/x-tiff': ['tiff', 'tif'],
  'image/x-ms-bmp': ['bmp'],
  'image/vnd.adobe.photoshop': ['psd'], // First layer
  'image/x-canon-cr2': ['cr2'],
  'image/x-nikon-nef': ['nef'],
  'image/x-sony-arw': ['arw'],
  'image/x-adobe-dng': ['dng'],
  'image/x-raw': ['raw'],
  'application/pdf': ['pdf'],
  'image/svg+xml': ['svg'],
  'image/x-icon': ['ico'],
  'image/vnd.microsoft.icon': ['ico'],
};

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'js', 'jar', 'sh', 'py',
  'rb', 'pl', 'php', 'asp', 'aspx', 'jsp', 'html', 'htm', 'xml', 'zip',
  'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dll', 'so', 'dylib', 'bin',
  'app', 'deb', 'rpm', 'apk', 'ipa',
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function validateImageFile(buffer: Buffer, slotKey: ImageSlotKey): Promise<{
  valid: boolean;
  error?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  warning?: string;
  detectedType?: string;
}> {
  const slot = getSlotConfig(slotKey);

  // Detect file type from magic bytes
  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType) {
    return { valid: false, error: 'Unable to determine file type. Please upload a valid image.' };
  }

  const detectedType = fileType.mime;
  const extension = fileType.ext;

  // Check for dangerous files
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: "This file can't be used as a photo. Please upload a JPG, PNG, HEIC, WebP or PDF.",
    };
  }

  // Check if MIME type is in our accepted list
  const allowedMimeTypes = Object.keys(ACCEPTED_MIMES).filter(mime =>
    ACCEPTED_MIMES[mime].some(ext => slot.acceptFormats.includes(ext as any))
  );

  if (!allowedMimeTypes.includes(detectedType)) {
    // Special handling: if it's an SVG and slot accepts SVG
    if (detectedType === 'image/svg+xml' && slot.acceptFormats.includes('svg')) {
      // Allow SVG for logos/icons
    } else if (detectedType === 'application/pdf' && slot.acceptFormats.includes('pdf' as any)) {
      // Allow PDF if slot permits
    } else {
      return {
        valid: false,
        error: `Unsupported format: ${detectedType}. Allowed: ${slot.acceptFormats.join(', ').toUpperCase()}`,
        detectedType,
      };
    }
  }

  // Check file size (50 MB max)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${formatBytes(buffer.length)} exceeds maximum 50 MB.`,
    };
  }

  // Handle SVG - we'll rasterize it
  if (detectedType === 'image/svg+xml') {
    return { valid: true, mimeType: detectedType, warning: 'SVG will be rasterized to PNG for web use.', detectedType };
  }

  // Handle PDF - convert first page
  if (detectedType === 'application/pdf') {
    return { valid: true, mimeType: detectedType, warning: 'First page of PDF will be converted to image.', detectedType };
  }

  // Handle RAW formats - sharp may support some
  const rawFormats = ['image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-raw'];
  if (rawFormats.includes(detectedType)) {
    return { valid: true, mimeType: detectedType, warning: 'RAW format will be converted to JPEG.', detectedType };
  }

  // For other image types, validate with sharp
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return { valid: false, error: 'Could not read image dimensions.' };
    }

    const totalPixels = metadata.width * metadata.height;
    if (totalPixels > MAX_PIXELS) {
      return {
        valid: false,
        error: `Image is too large (${metadata.width}×${metadata.height} = ${totalPixels.toLocaleString()} pixels). Maximum allowed: ${MAX_PIXELS.toLocaleString()} pixels (100 MP).`,
        width: metadata.width,
        height: metadata.height,
      };
    }

    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      return {
        valid: false,
        error: `Image dimensions (${metadata.width}×${metadata.height}) exceed maximum ${MAX_DIMENSION}px.`,
        width: metadata.width,
        height: metadata.height,
      };
    }

    // Check minimum dimensions (but don't block, just warn)
    let warning: string | undefined;
    if (metadata.width < slot.minWidth || metadata.height < slot.minHeight) {
      const ratio = Math.min(slot.minWidth / metadata.width, slot.minHeight / metadata.height);
      if (ratio > 2) {
        warning = `This photo is ${metadata.width}×${metadata.height}px. For best quality in ${slot.label}, we recommend at least ${slot.minWidth}×${slot.minHeight}px. It will be used at its natural size.`;
      }
    }

    // Quality assessment
    let qualityNote: 'good' | 'ok' | 'low' = 'good';
    const targetWidth = slot.suggestedWidth || slot.minWidth;
    const targetHeight = slot.suggestedHeight || slot.minHeight;
    const targetPixels = targetWidth * targetHeight;
    const pixelRatio = totalPixels / targetPixels;

    if (pixelRatio < 0.25) {
      qualityNote = 'low';
    } else if (pixelRatio < 1) {
      qualityNote = 'ok';
    }

    const originalRatio = metadata.width / metadata.height;
    const targetRatio = slot.aspectRatio.width / slot.aspectRatio.height;
    const ratioDiff = Math.abs(originalRatio - targetRatio) / targetRatio;

    if (ratioDiff > 0.3 && slot.cropMode === 'forced') {
      warning = (warning ? warning + ' ' : '') + `This photo has a ${formatAspectRatio({ width: metadata.width, height: metadata.height })} ratio, but the ${slot.label} requires ${formatAspectRatio(slot.aspectRatio)}. Smart crop will keep faces intact.`;
    }

    if (buffer.length < (slot.minFileSize || 0)) {
      warning = (warning ? warning + ' ' : '') + `This photo is ${formatBytes(buffer.length)}. For best quality, we recommend at least ${formatBytes(slot.minFileSize || 0)}.`;
    }

    return {
      valid: true,
      mimeType: detectedType,
      width: metadata.width,
      height: metadata.height,
      warning,
      detectedType,
    };
  } catch (error) {
    return { valid: false, error: 'Invalid or corrupted image file.', detectedType };
  }
}

export async function extractMetadata(buffer: Buffer): Promise<{
  orientation?: number;
  gps?: { lat: number; lon: number };
  hasExif: boolean;
  colorSpace?: string;
}> {
  try {
    const parser = parseExif(buffer);
    const orientation = parser.tags.Orientation;
    const gps = parser.tags.GPSLatitude && parser.tags.GPSLongitude ? {
      lat: parser.tags.GPSLatitude,
      lon: parser.tags.GPSLongitude,
    } : undefined;
    const colorSpace = parser.tags.ColorSpace;
    return { orientation, gps, hasExif: true, colorSpace };
  } catch {
    return { hasExif: false };
  }
}

export async function stripMetadata(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .withMetadata({ orientation: undefined })
    .toBuffer();
}

export async function autoOrientAndStrip(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .withMetadata({}) // Strip all metadata
    .toBuffer();
}

export async function convertToSrgb(buffer: Buffer): Promise<Buffer> {
  // Convert to sRGB color space
  return sharp(buffer)
    .toColorspace('srgb')
    .toBuffer();
}

export async function flattenTransparency(buffer: Buffer, backgroundColor: string = '#ffffff'): Promise<Buffer> {
  // Flatten transparency onto background color
  return sharp(buffer)
    .flatten({ background: backgroundColor })
    .toBuffer();
}

export async function rasterizeSvg(buffer: Buffer, width?: number, height?: number): Promise<Buffer> {
  // Convert SVG to PNG
  let pipeline = sharp(buffer, { density: 300 }); // High DPI for quality
  if (width && height) {
    pipeline = pipeline.resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } });
  }
  return pipeline.png().toBuffer();
}

export async function convertPdfToImage(buffer: Buffer): Promise<Buffer> {
  // Use sharp's PDF support (requires libvips with PDF support)
  // First page only
  return sharp(buffer, { density: 300, pages: 1 })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw new Error('HEIC conversion not supported. Please convert to JPEG before uploading.');
  }
}

export async function convertRawToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw new Error('RAW format not supported for conversion.');
  }
}

export async function extractFirstFrameGif(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { page: 0 }).jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw new Error('Could not extract frame from GIF.');
  }
}

export async function detectBlur(buffer: Buffer): Promise<number> {
  try {
    const { data, info } = await sharp(buffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    let sum = 0;
    let sumSq = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const center = data[idx];
        const laplacian =
          data[idx - width] +
          data[idx + width] +
          data[idx - 1] +
          data[idx + 1] -
          4 * center;

        sum += laplacian;
        sumSq += laplacian * laplacian;
      }
    }

    const mean = sum / ((width - 2) * (height - 2));
    const variance = sumSq / ((width - 2) * (height - 2)) - mean * mean;
    return variance;
  } catch {
    return 100;
  }
}

export async function detectBrightness(buffer: Buffer): Promise<number> {
  try {
    const { data } = await sharp(buffer)
      .resize(100, 100, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / data.length / 255;
  } catch {
    return 0.5;
  }
}

export async function detectFaceArea(buffer: Buffer): Promise<{ hasFace: boolean; area?: number; center?: { x: number; y: number }; box?: { x: number; y: number; width: number; height: number } }> {
  try {
    // Use a simple skin-tone detection as a proxy for face detection
    // In production, you'd use a proper face detection library like @vladmandic/face-api
    const { data, info } = await sharp(buffer)
      .resize(300, 300, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    let skinPixels = 0;
    let skinX = 0;
    let skinY = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let count = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Simple skin tone detection (RGB)
        if (r > 95 && g > 40 && b > 20 &&
          Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
          Math.abs(r - g) > 15 && r > g && r > b) {
          skinPixels++;
          skinX += x;
          skinY += y;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          count++;
        }
      }
    }

    if (count > 50) {
      return {
        hasFace: true,
        area: skinPixels / (width * height),
        center: { x: skinX / count / width, y: skinY / count / height },
        box: {
          x: minX / width,
          y: minY / height,
          width: (maxX - minX) / width,
          height: (maxY - minY) / height,
        },
      };
    }
    return { hasFace: false };
  } catch {
    return { hasFace: false };
  }
}

export async function detectSaliency(buffer: Buffer): Promise<{ x: number; y: number }> {
  // Simple entropy-based saliency detection
  // In production, use a proper saliency model
  try {
    const { data, info } = await sharp(buffer)
      .resize(100, 100, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    let maxEntropy = 0;
    let bestX = width / 2;
    let bestY = height / 2;

    // Sample regions for entropy
    const regionSize = 20;
    for (let y = 0; y <= height - regionSize; y += 10) {
      for (let x = 0; x <= width - regionSize; x += 10) {
        const histogram = new Array(256).fill(0);
        let pixels = 0;

        for (let ry = y; ry < y + regionSize; ry++) {
          for (let rx = x; rx < x + regionSize; rx++) {
            const idx = ry * width + rx;
            histogram[data[idx]]++;
            pixels++;
          }
        }

        let entropy = 0;
        for (const count of histogram) {
          if (count > 0) {
            const p = count / pixels;
            entropy -= p * Math.log2(p);
          }
        }

        if (entropy > maxEntropy) {
          maxEntropy = entropy;
          bestX = x + regionSize / 2;
          bestY = y + regionSize / 2;
        }
      }
    }

    return { x: bestX / width, y: bestY / height };
  } catch {
    return { x: 0.5, y: 0.5 };
  }
}

export async function generateBlurDataURL(buffer: Buffer, width = 20, height = 20): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(width, height, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blurhash = blurhashEncode(new Uint8ClampedArray(data), info.width, info.height, BLURHASH_COMPONENTS.x, BLURHASH_COMPONENTS.y);

  const tinyBuffer = await sharp(buffer)
    .resize(width, height, { fit: 'cover' })
    .jpeg({ quality: 20 })
    .toBuffer();

  const base64 = tinyBuffer.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

export async function getDominantColor(buffer: Buffer): Promise<string> {
  try {
    const { data } = await sharp(buffer)
      .resize(50, 50, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colorCounts: Record<string, number> = {};
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i] >> 4;
      const g = data[i + 1] >> 4;
      const b = data[i + 2] >> 4;
      const key = `${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }

    let maxCount = 0;
    let dominantKey = '888';
    for (const [key, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantKey = key;
      }
    }

    return `#${dominantKey.padEnd(6, '0')}`;
  } catch {
    return '#888888';
  }
}

export async function smartCrop(
  buffer: Buffer,
  targetRatio: { width: number; height: number },
  faceArea?: { center?: { x: number; y: number }; box?: { x: number; y: number; width: number; height: number } },
  focalPoint?: { x: number; y: number }
): Promise<{ x: number; y: number; width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read image metadata');
  }

  const targetAspect = targetRatio.width / targetRatio.height;
  const originalAspect = metadata.width / metadata.height;

  // If aspect ratios match closely, no crop needed
  if (Math.abs(originalAspect - targetAspect) / targetAspect < 0.02) {
    return { x: 0, y: 0, width: metadata.width, height: metadata.height };
  }

  let cropX = 0, cropY = 0, cropWidth = 0, cropHeight = 0;

  if (originalAspect > targetAspect) {
    // Image is wider than target - crop horizontally
    cropHeight = metadata.height;
    cropWidth = Math.round(cropHeight * targetAspect);
    const maxX = metadata.width - cropWidth;

    // Determine horizontal position
    let targetCenterX = 0.5; // Default center

    if (faceArea?.box) {
      // Use face center
      targetCenterX = faceArea.box.x + faceArea.box.width / 2;
    } else if (faceArea?.center) {
      targetCenterX = faceArea.center.x;
    } else if (focalPoint) {
      targetCenterX = focalPoint.x;
    } else {
      // Use saliency
      const saliency = await detectSaliency(buffer);
      targetCenterX = saliency.x;
    }

    cropX = Math.round(Math.max(0, Math.min(maxX, targetCenterX * metadata.width - cropWidth / 2)));
  } else {
    // Image is taller than target - crop vertically
    cropWidth = metadata.width;
    cropHeight = Math.round(cropWidth / targetAspect);
    const maxY = metadata.height - cropHeight;

    // Determine vertical position
    let targetCenterY = 0.5; // Default center

    if (faceArea?.box) {
      // Use face center
      targetCenterY = faceArea.box.y + faceArea.box.height / 2;
    } else if (faceArea?.center) {
      targetCenterY = faceArea.center.y;
    } else if (focalPoint) {
      targetCenterY = focalPoint.y;
    } else {
      // Use saliency
      const saliency = await detectSaliency(buffer);
      targetCenterY = saliency.y;
    }

    cropY = Math.round(Math.max(0, Math.min(maxY, targetCenterY * metadata.height - cropHeight / 2)));
  }

  // Ensure face isn't cut off - if face box would be cut, widen crop
  if (faceArea?.box) {
    const faceLeft = faceArea.box.x * metadata.width;
    const faceRight = faceLeft + faceArea.box.width * metadata.width;
    const faceTop = faceArea.box.y * metadata.height;
    const faceBottom = faceTop + faceArea.box.height * metadata.height;

    const cropLeft = cropX;
    const cropRight = cropX + cropWidth;
    const cropTop = cropY;
    const cropBottom = cropY + cropHeight;

    // If face would be cut, expand crop to include it (blurred background fit)
    if (faceLeft < cropLeft || faceRight > cropRight || faceTop < cropTop || faceBottom > cropBottom) {
      // Switch to contain mode with blurred background
      return { x: 0, y: 0, width: metadata.width, height: metadata.height };
    }
  }

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

export async function applyContainWithBlur(
  buffer: Buffer,
  targetRatio: { width: number; height: number },
  backgroundColor: string = '#ffffff'
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read image metadata');
  }

  const targetAspect = targetRatio.width / targetRatio.height;
  const originalAspect = metadata.width / metadata.height;

  // Create blurred background
  const background = await sharp(buffer)
    .resize(
      targetAspect > originalAspect ? metadata.width : Math.round(metadata.height * targetAspect),
      targetAspect > originalAspect ? Math.round(metadata.width / targetAspect) : metadata.height,
      { fit: 'cover' }
    )
    .blur(50)
    .toBuffer();

  // Overlay original centered
  const result = await sharp(background)
    .composite([{
      input: buffer,
      gravity: 'center',
    }])
    .toBuffer();

  return result;
}

async function encodeWithBudget(
  buffer: Buffer,
  width: number,
  height: number,
  format: SharpFormat,
  budget: number,
  maxQuality = 85,
  minQuality = 30
): Promise<Buffer> {
  let quality = maxQuality;
  let result = buffer;

  // Binary search for quality that meets budget
  while (quality >= minQuality) {
    const options: SharpOptions = {
      quality,
    };

    if (format === 'avif') {
      (options as AvifOptions).effort = 4;
    } else if (format === 'jpeg') {
      (options as JpegOptions).progressive = true;
      (options as JpegOptions).chromaSubsampling = '4:2:0';
      (options as JpegOptions).mozjpeg = true;
    }

    result = await sharp(buffer)
      .resize(width, height, { fit: 'cover' })
      .toFormat(format, options)
      .toBuffer();

    if (result.length <= budget) {
      break;
    }

    quality -= 5;
  }

  // If still over budget at min quality, resize down
  if (result.length > budget && quality <= minQuality) {
    let scale = Math.sqrt(budget / result.length);
    scale = Math.max(0.5, scale); // Don't scale below 50%

    result = await sharp(buffer)
      .resize(Math.round(width * scale), Math.round(height * scale), { fit: 'cover' })
      .toFormat(format, { quality: minQuality })
      .toBuffer();
  }

  return result;
}

export async function processImageVariants(
  buffer: Buffer,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const slot = getSlotConfig(options.slot);
  const warnings: string[] = [];

  // Step 1: Auto-rotate and strip metadata
  let processedBuffer = await autoOrientAndStrip(buffer);

  // Step 2: Convert to sRGB
  processedBuffer = await convertToSrgb(processedBuffer);

  // Step 3: Handle transparency
  const metadata = await sharp(processedBuffer).metadata();
  const hasAlpha = metadata.channels === 4 || metadata.hasAlpha;

  if (hasAlpha && !options.isLogo) {
    // Flatten onto background color (default white, or slot-specific)
    const bgColor = options.backgroundColor || '#ffffff';
    processedBuffer = await flattenTransparency(processedBuffer, bgColor);
  }

  // Step 4: Detect faces
  const faceArea = await detectFaceArea(processedBuffer);

  // Step 5: Smart crop to slot ratio
  let croppedBuffer = processedBuffer;
  let cropData: CropData | null = null;

  if (options.crop) {
    // Manual crop provided
    croppedBuffer = await sharp(processedBuffer)
      .extract({
        left: Math.round(options.crop.x),
        top: Math.round(options.crop.y),
        width: Math.round(options.crop.width),
        height: Math.round(options.crop.height),
      })
      .toBuffer();
    cropData = options.crop;
  } else if (slot.cropMode === 'forced') {
    // Smart crop
    const crop = await smartCrop(processedBuffer, slot.aspectRatio, faceArea, options.focalPoint);

    // Check if we need contain mode (face would be cut)
    const isContain = crop.x === 0 && crop.y === 0 && crop.width === metadata.width && crop.height === metadata.height;

    if (isContain) {
      // Use blurred background contain
      croppedBuffer = await applyContainWithBlur(processedBuffer, slot.aspectRatio, options.backgroundColor || '#ffffff');
      cropData = { x: 0, y: 0, width: metadata.width, height: metadata.height };
      warnings.push('Image shown with blurred background to preserve full content.');
    } else {
      croppedBuffer = await sharp(processedBuffer)
        .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
        .toBuffer();
      cropData = crop;
    }
  } else if (slot.cropMode === 'free') {
    // Gallery - keep natural ratio, no crop
    cropData = { x: 0, y: 0, width: metadata.width, height: metadata.height };
  } else if (slot.cropMode === 'auto-fit') {
    // Auto-fit with blurred background
    croppedBuffer = await applyContainWithBlur(processedBuffer, slot.aspectRatio, options.backgroundColor || '#ffffff');
    cropData = { x: 0, y: 0, width: metadata.width, height: metadata.height };
  }

  const croppedMetadata = await sharp(croppedBuffer).metadata();
  const finalWidth = croppedMetadata.width || 0;
  const finalHeight = croppedMetadata.height || 0;

  // Step 6: Generate blur data URL and dominant color
  const [blurDataURL, dominantColor] = await Promise.all([
    generateBlurDataURL(croppedBuffer),
    getDominantColor(croppedBuffer),
  ]);

  // Step 7: Quality assessment
  const originalMetadata = await sharp(buffer).metadata();
  const originalPixels = (originalMetadata.width || 0) * (originalMetadata.height || 0);
  const targetPixels = (slot.suggestedWidth || slot.minWidth) * (slot.suggestedHeight || slot.minHeight);
  const pixelRatio = targetPixels > 0 ? originalPixels / targetPixels : 1;

  let qualityNote: 'good' | 'ok' | 'low' = 'good';
  if (pixelRatio < 0.25) {
    qualityNote = 'low';
    warnings.push('Low resolution - best used at small sizes.');
  } else if (pixelRatio < 1) {
    qualityNote = 'ok';
    warnings.push('Good quality, may look slightly soft on large screens.');
  }

  // Blur/brightness warnings
  const blurScore = await detectBlur(croppedBuffer);
  const brightness = await detectBrightness(croppedBuffer);

  if (blurScore < 50) {
    warnings.push('Image appears blurry. Consider retaking for better sharpness.');
  }
  if (brightness < 0.2) {
    warnings.push('Image is very dark. Consider a brighter photo.');
  } else if (brightness > 0.9) {
    warnings.push('Image is very bright/overexposed.');
  }

  // Step 8: Generate variants with size budgets
  const variants: VariantInfo[] = [];

  if (options.generateVariants !== false) {
    const budgets = SIZE_BUDGETS[options.slot] || { mobile: 200 * 1024, desktop: 400 * 1024 };

    for (const targetWidth of VARIANT_WIDTHS) {
      if (targetWidth > finalWidth) continue;

      const targetHeight = Math.round((targetWidth / finalWidth) * finalHeight);
      const isMobile = targetWidth <= 640;
      const budget = isMobile ? budgets.mobile : budgets.desktop;

      for (const format of VARIANT_FORMATS) {
        const variantBuffer = await encodeWithBudget(
          croppedBuffer,
          targetWidth,
          targetHeight,
          format,
          budget
        );

        variants.push({
          width: targetWidth,
          height: targetHeight,
          format,
          buffer: variantBuffer,
          size: variantBuffer.length,
          blurDataURL: format === 'jpeg' ? await generateBlurDataURL(variantBuffer) : undefined,
        });
      }
    }
  }

  const original: ProcessedImage = {
    buffer: croppedBuffer,
    width: finalWidth,
    height: finalHeight,
    format: 'jpeg',
    size: croppedBuffer.length,
    blurDataURL,
    dominantColor,
  };

  return {
    original,
    variants,
    cropData,
    warnings,
    qualityNote,
    faceDetected: faceArea.hasFace,
    faceArea: faceArea.box ? {
      x: faceArea.box.x * finalWidth,
      y: faceArea.box.y * finalHeight,
      width: faceArea.box.width * finalWidth,
      height: faceArea.box.height * finalHeight,
    } : undefined,
  };
}

export function slugifyFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

export function generateVariantFilename(
  originalFilename: string,
  width: number,
  format: string
): string {
  const base = slugifyFilename(originalFilename);
  const hash = Math.random().toString(36).substring(2, 8);
  return `${base}-${width}w-${hash}.${format}`;
}

export function generateOriginalFilename(originalFilename: string): string {
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
  const hash = Math.random().toString(36).substring(2, 10);
  return `original-${hash}.${ext}`;
}

export function isHeic(buffer: Buffer): boolean {
  const heicSignatures = [
    Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
    Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x69, 0x66, 0x31]),
  ];

  return heicSignatures.some(sig => buffer.subarray(0, sig.length).equals(sig));
}

// Pre-process file based on detected type
export async function preprocessFile(buffer: Buffer, mimeType: string): Promise<Buffer> {
  switch (mimeType) {
    case 'image/heic':
    case 'image/heif':
      return convertHeicToJpeg(buffer);
    case 'image/gif':
      return extractFirstFrameGif(buffer);
    case 'image/svg+xml':
      return rasterizeSvg(buffer);
    case 'application/pdf':
      return convertPdfToImage(buffer);
    case 'image/x-canon-cr2':
    case 'image/x-nikon-nef':
    case 'image/x-sony-arw':
    case 'image/x-adobe-dng':
    case 'image/x-raw':
      return convertRawToJpeg(buffer);
    default:
      return buffer;
  }
}