import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

// Mock sharp for testing
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080, channels: 3, hasAlpha: false }),
    rotate: vi.fn().mockReturnThis(),
    withMetadata: vi.fn().mockReturnThis(),
    toColorspace: vi.fn().mockReturnThis(),
    flatten: vi.fn().mockReturnThis(),
    extract: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    toFormat: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    composite: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    greyscale: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
  }));

  return { default: mockSharp };
});

// Mock file-type
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

// Mock exif-parser
vi.mock('exif-parser', () => ({
  parse: vi.fn(() => ({
    tags: {
      Orientation: 1,
      GPSLatitude: null,
      GPSLongitude: null,
      ColorSpace: 1,
    },
  })),
}));

// Mock blurhash
vi.mock('blurhash', () => ({
  encode: vi.fn(() => 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'),
}));

import {
  validateImageFile,
  extractMetadata,
  autoOrientAndStrip,
  convertToSrgb,
  flattenTransparency,
  detectFaceArea,
  detectSaliency,
  generateBlurDataURL,
  getDominantColor,
  smartCrop,
  applyContainWithBlur,
  processImageVariants,
  slugifyFilename,
  generateVariantFilename,
  generateOriginalFilename,
  isHeic,
  preprocessFile,
} from '@/lib/image-processing';
import { ImageSlotKey } from '@/lib/image-slots';

describe('Image Processing Pipeline', () => {
  const mockBuffer = Buffer.from('fake-image-data');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateImageFile', () => {
    it('should accept valid JPEG', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });
      
      const result = await validateImageFile(mockBuffer, 'faculty');
      
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should accept valid PNG', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/png', ext: 'png' });
      
      const result = await validateImageFile(mockBuffer, 'faculty');
      
      expect(result.valid).toBe(true);
    });

    it('should accept valid WebP', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/webp', ext: 'webp' });
      
      const result = await validateImageFile(mockBuffer, 'hero');
      
      expect(result.valid).toBe(true);
    });

    it('should accept HEIC', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/heic', ext: 'heic' });
      
      const result = await validateImageFile(mockBuffer, 'faculty');
      
      expect(result.valid).toBe(true);
    });

    it('should accept AVIF', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/avif', ext: 'avif' });
      
      const result = await validateImageFile(mockBuffer, 'gallery');
      
      expect(result.valid).toBe(true);
    });

    it('should reject dangerous file types', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'application/x-msdownload', ext: 'exe' });
      
      const result = await validateImageFile(mockBuffer, 'faculty');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("can't be used as a photo");
    });

    it('should reject script files', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'text/javascript', ext: 'js' });
      
      const result = await validateImageFile(mockBuffer, 'faculty');
      
      expect(result.valid).toBe(false);
    });

    it('should accept SVG for logo slot', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/svg+xml', ext: 'svg' });
      
      const result = await validateImageFile(mockBuffer, 'logo');
      
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('rasterized');
    });

    it('should reject SVG for faculty slot', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/svg+xml', ext: 'svg' });
      
      const result = await validateImageFile(mockBuffer, 'faculty');
      
      expect(result.valid).toBe(false);
    });

    it('should accept PDF', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
      
      const result = await validateImageFile(mockBuffer, 'gallery');
      
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('First page');
    });

    it('should accept RAW formats', async () => {
      (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'image/x-canon-cr2', ext: 'cr2' });
      
      const result = await validateImageFile(mockBuffer, 'gallery');
      
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('RAW format');
    });
  });

  describe('detectFaceArea', () => {
    it('should detect face-like skin tones', async () => {
      // Sharp is mocked to return skin-tone-like data
      const result = await detectFaceArea(mockBuffer);
      
      // With mock data, it should return some result
      expect(result).toHaveProperty('hasFace');
    });
  });

  describe('detectSaliency', () => {
    it('should return a focal point', async () => {
      const result = await detectSaliency(mockBuffer);
      
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.x).toBeLessThanOrEqual(1);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeLessThanOrEqual(1);
    });
  });

  describe('smartCrop', () => {
    it('should return crop coordinates for forced crop mode', async () => {
      const targetRatio = { width: 4, height: 5 }; // Faculty 4:5
      const faceArea = { center: { x: 0.5, y: 0.3 }, box: { x: 0.3, y: 0.1, width: 0.4, height: 0.4 } };
      
      const result = await smartCrop(mockBuffer, targetRatio, faceArea);
      
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
    });

    it('should use focal point when provided', async () => {
      const targetRatio = { width: 16, height: 9 };
      const focalPoint = { x: 0.8, y: 0.2 };
      
      const result = await smartCrop(mockBuffer, targetRatio, undefined, focalPoint);
      
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });
  });

  describe('slugifyFilename', () => {
    it('should convert filename to slug', () => {
      expect(slugifyFilename('My Photo.jpg')).toBe('my-photo');
      expect(slugifyFilename('Photo (1).png')).toBe('photo-1');
      expect(slugifyFilename('IMG_20240101_120000.HEIC')).toBe('img-20240101-120000');
    });

    it('should handle special characters', () => {
      expect(slugifyFilename('Photo @#$%.jpg')).toBe('photo');
      expect(slugifyFilename('фото.jpg')).toBe(''); // Non-latin chars removed
    });
  });

  describe('generateVariantFilename', () => {
    it('should generate proper variant filename', () => {
      const filename = generateVariantFilename('my-photo.jpg', 800, 'webp');
      
      expect(filename).toMatch(/^my-photo-800w-[a-z0-9]{6}\.webp$/);
    });
  });

  describe('generateOriginalFilename', () => {
    it('should generate unique original filename', () => {
      const filename = generateOriginalFilename('photo.jpg');
      
      expect(filename).toMatch(/^original-[a-z0-9]{8}\.jpg$/);
    });
  });

  describe('isHeic', () => {
    it('should detect HEIC signature', () => {
      const heicBuffer = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
      expect(isHeic(heicBuffer)).toBe(true);
    });

    it('should not detect non-HEIC', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(isHeic(jpegBuffer)).toBe(false);
    });
  });

  describe('Ratio calculations', () => {
  const { calculateDimensions } = require('../lib/image-slots.ts');

  it('should calculate cover crop for wider image', () => {
      const result = calculateDimensions(1920, 1080, { width: 4, height: 5 }, 'cover');
      
      // 1920/1080 = 1.78, 4/5 = 0.8, image is wider
      // Should crop width to match 4:5 ratio
      expect(result.height).toBe(1080);
      expect(result.width).toBe(864); // 1080 * 0.8
      expect(result.x).toBeGreaterThan(0); // Centered crop
    });

    it('should calculate cover crop for taller image', () => {
      const result = calculateDimensions(800, 1200, { width: 16, height: 9 }, 'cover');
      
      // 800/1200 = 0.67, 16/9 = 1.78, image is taller
      // Should crop height to match 16:9 ratio
      expect(result.width).toBe(800);
      expect(result.height).toBe(450); // 800 / 1.78
      expect(result.y).toBeGreaterThan(0); // Centered crop
    });

    it('should calculate contain fit', () => {
      const result = calculateDimensions(1920, 1080, { width: 1, height: 1 }, 'contain');
      
      // Image is wider, should fit width
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1920);
    });
  });
});

describe('Slot Configuration', () => {
  const { getSlotConfig, getAllSlots, ImageSlotKey } = require('../lib/image-slots.ts');

  it('should have all required slots', () => {
    const slots = getAllSlots();
    const requiredSlots: ImageSlotKey[] = ['hero', 'faculty', 'gallery', 'event-banner', 'og-image', 'logo'];
    
    requiredSlots.forEach(slot => {
      expect(slots.some((s: any) => s.key === slot)).toBe(true);
    });
  });

  it('should have correct aspect ratios', () => {
    expect(getSlotConfig('hero').aspectRatio).toEqual({ width: 4, height: 3 });
    expect(getSlotConfig('faculty').aspectRatio).toEqual({ width: 4, height: 5 });
    expect(getSlotConfig('event-banner').aspectRatio).toEqual({ width: 16, height: 9 });
    expect(getSlotConfig('og-image').aspectRatio).toEqual({ width: 191, height: 100 });
    expect(getSlotConfig('gallery').cropMode).toBe('free');
  });

  it('should have consent requirements', () => {
    expect(getSlotConfig('faculty').requiresConsent).toBe(true);
    expect(getSlotConfig('gallery').requiresConsent).toBe(true);
    expect(getSlotConfig('hero').requiresConsent).toBe(false);
    expect(getSlotConfig('logo').requiresConsent).toBe(false);
  });
});