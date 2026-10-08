export type ImageSlotKey =
  | 'hero'
  | 'about'
  | 'faculty'
  | 'gallery'
  | 'gallery-thumbnail'
  | 'testimonial-avatar'
  | 'result'
  | 'event-banner'
  | 'og-image'
  | 'logo'
  | 'favicon';

export interface ImageSlotConfig {
  key: ImageSlotKey;
  label: string;
  description: string;
  aspectRatio: { width: number; height: number };
  minWidth: number;
  minHeight: number;
  maxFileSize: number; // bytes
  minFileSize?: number; // bytes - for warning
  suggestedWidth?: number;
  suggestedHeight?: number;
  cropMode: 'forced' | 'free' | 'auto-fit';
  faceAware: boolean;
  focalPoint: boolean;
  category: 'hero' | 'portrait' | 'gallery' | 'avatar' | 'banner' | 'brand' | 'thumbnail';
  exampleUrl?: string;
  acceptFormats: ('jpg' | 'png' | 'webp' | 'heic' | 'avif' | 'svg' | 'pdf' | 'cr2' | 'nef' | 'arw' | 'dng' | 'raw' | 'gif' | 'bmp' | 'tiff' | 'jfif' | 'ico')[];
  requiresConsent: boolean;
  altRequired: boolean;
  altSuggestion?: string;
  placeholderText: string;
  placeholderColor: string;
}

export const IMAGE_SLOTS: Record<ImageSlotKey, ImageSlotConfig> = {
  hero: {
    key: 'hero',
    label: 'Hero Image',
    description: 'Main banner on the homepage. Desktop 4:3, mobile adapts.',
    aspectRatio: { width: 4, height: 3 },
    minWidth: 1200,
    minHeight: 900,
    suggestedWidth: 1920,
    suggestedHeight: 1440,
    maxFileSize: 10 * 1024 * 1024,
    minFileSize: 500 * 1024,
    cropMode: 'forced',
    faceAware: false,
    focalPoint: true,
    category: 'hero',
    acceptFormats: ['jpg', 'png', 'webp', 'heic', 'avif'],
    requiresConsent: false,
    altRequired: true,
    altSuggestion: 'Students learning in a bright classroom at Brilliant Minds Tutorials',
    placeholderText: 'Hero Image (4:3)',
    placeholderColor: '#0B2A5B',
  },
  about: {
    key: 'about',
    label: 'About Section Photo',
    description: 'Photo for the "About Us" section. 4:3 ratio works best.',
    aspectRatio: { width: 4, height: 3 },
    minWidth: 1000,
    minHeight: 750,
    suggestedWidth: 1600,
    suggestedHeight: 1200,
    maxFileSize: 8 * 1024 * 1024,
    minFileSize: 400 * 1024,
    cropMode: 'forced',
    faceAware: false,
    focalPoint: true,
    category: 'hero',
    acceptFormats: ['jpg', 'png', 'webp', 'heic', 'avif'],
    requiresConsent: false,
    altRequired: true,
    altSuggestion: 'Teacher working with students at Brilliant Minds Tutorials',
    placeholderText: 'About Photo (4:3)',
    placeholderColor: '#1E6BFF',
  },
  faculty: {
    key: 'faculty',
    label: 'Faculty Photo',
    description: 'Portrait photo for faculty cards. 4:5 keeps faces centered.',
    aspectRatio: { width: 4, height: 5 },
    minWidth: 600,
    minHeight: 750,
    suggestedWidth: 800,
    suggestedHeight: 1000,
    maxFileSize: 5 * 1024 * 1024,
    minFileSize: 200 * 1024,
    cropMode: 'forced',
    faceAware: true,
    focalPoint: false,
    category: 'portrait',
    acceptFormats: ['jpg', 'png', 'webp', 'heic', 'avif'],
    requiresConsent: true,
    altRequired: true,
    altSuggestion: 'Portrait of {name}, {subject} teacher',
    placeholderText: 'Faculty Portrait (4:5)',
    placeholderColor: '#F5B82E',
  },
  gallery: {
    key: 'gallery',
    label: 'Gallery Image',
    description: 'Gallery photos keep their original ratio. Masonry layout.',
    aspectRatio: { width: 1, height: 1 }, // not enforced
    minWidth: 800,
    minHeight: 600,
    suggestedWidth: 1600,
    suggestedHeight: 1200,
    maxFileSize: 10 * 1024 * 1024,
    minFileSize: 300 * 1024,
    cropMode: 'free',
    faceAware: false,
    focalPoint: true,
    category: 'gallery',
    acceptFormats: ['jpg', 'png', 'webp', 'heic', 'avif', 'pdf', 'cr2', 'nef', 'arw', 'dng', 'raw'] as const,
    requiresConsent: true,
    altRequired: true,
    altSuggestion: 'Gallery photo from Brilliant Minds Tutorials',
    placeholderText: 'Gallery Photo (any ratio)',
    placeholderColor: '#4A5873',
  },
  'gallery-thumbnail': {
    key: 'gallery-thumbnail',
    label: 'Gallery Thumbnail (Auto-generated)',
    description: 'Auto-generated 1:1 thumbnails for gallery grid. Do not upload directly.',
    aspectRatio: { width: 1, height: 1 },
    minWidth: 400,
    minHeight: 400,
    suggestedWidth: 400,
    suggestedHeight: 400,
    maxFileSize: 500 * 1024,
    cropMode: 'forced',
    faceAware: false,
    focalPoint: true,
    category: 'thumbnail',
    acceptFormats: ['jpg', 'png', 'webp', 'avif'],
    requiresConsent: false,
    altRequired: false,
    placeholderText: 'Auto-generated',
    placeholderColor: '#DCE6F7',
  },
  'testimonial-avatar': {
    key: 'testimonial-avatar',
    label: 'Testimonial Avatar',
    description: 'Optional 1:1 avatar for student testimonials.',
    aspectRatio: { width: 1, height: 1 },
    minWidth: 200,
    minHeight: 200,
    suggestedWidth: 400,
    suggestedHeight: 400,
    maxFileSize: 2 * 1024 * 1024,
    cropMode: 'forced',
    faceAware: true,
    focalPoint: false,
    category: 'avatar',
    acceptFormats: ['jpg', 'png', 'webp', 'heic', 'avif'],
    requiresConsent: true,
    altRequired: false,
    altSuggestion: 'Photo of {name}',
    placeholderText: 'Avatar (1:1)',
    placeholderColor: '#DCE6F7',
  },
  result: {
    key: 'result',
    label: 'Result/Achievement Photo',
    description: 'Photo for student achievements. 4:3 landscape.',
    aspectRatio: { width: 4, height: 3 },
    minWidth: 800,
    minHeight: 600,
    suggestedWidth: 1200,
    suggestedHeight: 900,
    maxFileSize: 5 * 1024 * 1024,
    minFileSize: 200 * 1024,
    cropMode: 'forced',
    faceAware: false,
    focalPoint: true,
    category: 'gallery',
    acceptFormats: ['jpg', 'png', 'webp', 'heic', 'avif'],
    requiresConsent: true,
    altRequired: true,
    altSuggestion: '{name} receiving award at Brilliant Minds Tutorials',
    placeholderText: 'Achievement Photo (4:3)',
    placeholderColor: '#1E6BFF',
  },
  'event-banner': {
    key: 'event-banner',
    label: 'Event/Announcement Banner',
    description: '16:9 banner for events and announcements with text overlay safe zone.',
    aspectRatio: { width: 16, height: 9 },
    minWidth: 1280,
    minHeight: 720,
    suggestedWidth: 1920,
    suggestedHeight: 1080,
    maxFileSize: 5 * 1024 * 1024,
    minFileSize: 300 * 1024,
    cropMode: 'forced',
    faceAware: false,
    focalPoint: true,
    category: 'banner',
    acceptFormats: ['jpg', 'png', 'webp', 'heic', 'avif'],
    requiresConsent: false,
    altRequired: true,
    altSuggestion: 'Banner for {title} event',
    placeholderText: 'Event Banner (16:9)',
    placeholderColor: '#0B2A5B',
  },
  'og-image': {
    key: 'og-image',
    label: 'Open Graph / Social Share Image',
    description: '1.91:1 image for Facebook, LinkedIn, Twitter cards.',
    aspectRatio: { width: 191, height: 100 },
    minWidth: 1200,
    minHeight: 630,
    suggestedWidth: 1200,
    suggestedHeight: 630,
    maxFileSize: 3 * 1024 * 1024,
    cropMode: 'forced',
    faceAware: false,
    focalPoint: true,
    category: 'banner',
    acceptFormats: ['jpg', 'png', 'webp'],
    requiresConsent: false,
    altRequired: true,
    altSuggestion: 'Brilliant Minds Tutorials - Coaching Classes in Lucknow',
    placeholderText: 'OG Image (1.91:1)',
    placeholderColor: '#0B2A5B',
  },
  logo: {
    key: 'logo',
    label: 'Logo',
    description: 'Logo with transparent background. SVG preferred. Original ratio preserved.',
    aspectRatio: { width: 1, height: 1 }, // not enforced
    minWidth: 512,
    minHeight: 512,
    suggestedWidth: 512,
    suggestedHeight: 512,
    maxFileSize: 2 * 1024 * 1024,
    cropMode: 'free',
    faceAware: false,
    focalPoint: false,
    category: 'brand',
    acceptFormats: ['svg', 'png', 'webp'],
    requiresConsent: false,
    altRequired: true,
    altSuggestion: 'Brilliant Minds Tutorials Logo',
    placeholderText: 'Logo (transparent)',
    placeholderColor: '#ffffff',
  },
  favicon: {
    key: 'favicon',
    label: 'Favicon',
    description: '1:1 square icon for browser tabs. Generated from logo if not provided.',
    aspectRatio: { width: 1, height: 1 },
    minWidth: 512,
    minHeight: 512,
    suggestedWidth: 512,
    suggestedHeight: 512,
    maxFileSize: 500 * 1024,
    cropMode: 'forced',
    faceAware: false,
    focalPoint: false,
    category: 'brand',
    acceptFormats: ['png', 'svg'],
    requiresConsent: false,
    altRequired: false,
    placeholderText: 'Favicon (1:1)',
    placeholderColor: '#ffffff',
  },
};

export function getSlotConfig(key: ImageSlotKey): ImageSlotConfig {
  return IMAGE_SLOTS[key];
}

export function getSlotsByCategory(category: ImageSlotConfig['category']): ImageSlotConfig[] {
  return Object.values(IMAGE_SLOTS).filter(s => s.category === category);
}

export function getAllSlots(): ImageSlotConfig[] {
  return Object.values(IMAGE_SLOTS);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAspectRatio(ratio: { width: number; height: number }): string {
  return `${ratio.width}:${ratio.height}`;
}

export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  targetRatio: { width: number; height: number },
  mode: 'cover' | 'contain' = 'cover'
): { width: number; height: number; x: number; y: number } {
  const targetAspect = targetRatio.width / targetRatio.height;
  const originalAspect = originalWidth / originalHeight;

  let width, height, x, y;

  if (mode === 'cover') {
    if (originalAspect > targetAspect) {
      // Image is wider than target
      height = originalHeight;
      width = height * targetAspect;
      x = (originalWidth - width) / 2;
      y = 0;
    } else {
      // Image is taller than target
      width = originalWidth;
      height = width / targetAspect;
      x = 0;
      y = (originalHeight - height) / 2;
    }
  } else {
    // contain mode
    if (originalAspect > targetAspect) {
      width = originalWidth;
      height = width / targetAspect;
      x = 0;
      y = (originalHeight - height) / 2;
    } else {
      height = originalHeight;
      width = height * targetAspect;
      x = (originalWidth - width) / 2;
      y = 0;
    }
  }

  return { width: Math.round(width), height: Math.round(height), x: Math.round(x), y: Math.round(y) };
}