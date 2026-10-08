import { vi } from 'vitest';

// Mock sharp globally
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080, channels: 3, hasAlpha: false, format: 'jpeg' }),
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

// Mock bullmq
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    on: vi.fn(),
    getJob: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
  Job: vi.fn(),
}));

// Mock ioredis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    quit: vi.fn(),
  })),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // Simple mock without JSX
    return { src, alt, ...props, $$typeof: Symbol.for('react.element'), type: 'img' };
  },
}));

// Global test timeout
vi.setConfig({ testTimeout: 10000 });