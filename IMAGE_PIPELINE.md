# Zero-Friction Image Pipeline

## Overview

The Brilliant Minds Tutorials image pipeline allows administrators to upload photos of **any size, any ratio, and any common format** from phones or computers. The system automatically processes images to display correctly on the public website with optimal performance.

## Core Promise

> The owner can upload a photo of ANY size, ANY ratio and ANY common format, from a phone or computer, and the public website always shows it in the correct ratio, sharp as possible, fast-loading and never broken, stretched or cut-off. The owner never has to resize, convert or rename anything.

---

## Accepted Input Formats

| Category | Formats | Notes |
|----------|---------|-------|
| **Photos** | JPG/JPEG, PNG, WebP, AVIF, HEIC/HEIF (iPhone), GIF (first frame), BMP, TIFF, JFIF, ICO | Auto-detected by magic bytes |
| **Camera RAW** | DNG, CR2 (Canon), NEF (Nikon), ARW (Sony) | Where libvips supports it |
| **Documents** | PDF (first page), Screenshots | Converted to image |
| **Vector** | SVG | Sanitized/rasterized for logos/icons only |

### Validation Rules
- **Type detection**: By file signatures (magic bytes), never by extension or MIME type
- **Wrong extensions**: `.jpg` that is really `.png` still works
- **Dangerous files**: Executables, scripts, archives, corrupt files rejected with clear message
- **Size limits**: Up to 50 MB and 100 megapixels with decompression-bomb protection
- **Batch upload**: Up to 50 files with per-file progress and retry
- **Input methods**: Drag-drop, folder drop, clipboard paste, "Take Photo" on mobile

---

## Automatic Processing (Server-Side)

### Pipeline Steps
1. **Validate & Auto-Rotate** - EXIF orientation applied
2. **Strip Metadata** - All EXIF, GPS, camera/owner info removed (student privacy)
3. **Color Profile** - Convert to sRGB, flatten transparency onto slot background (except logos)
4. **Store Original** - Untouched original kept privately for re-cropping
5. **Smart Crop** - Face detection → Saliency/entropy → Saved focal point
   - Never stretches or squashes
   - Never leaves empty bars
   - Widens crop or uses blurred-background "fit" if face would be cut
   - Panoramas/tall screenshots use blurred-background "contain"
6. **Responsive Resize** - Widths: 320, 480, 640, 960, 1280, 1600, 1920 (never upscale)
7. **Multi-Format Encode** - AVIF → WebP → JPEG (progressive, mozjpeg q78)
   - Re-encodes to hit size budgets
8. **Placeholders** - BlurHash + dominant color
9. **Content-Hashed Filenames** - Immutable long-cache headers, CDN-ready
10. **Database Record** - Full metadata, variants, crop, focal point, consent, status

### Size Budgets
| Slot | Mobile | Desktop |
|------|--------|---------|
| Hero | ≤150 KB | ≤300 KB |
| Faculty | ≤60 KB | ≤100 KB |
| Gallery Thumbnail | ≤40 KB | ≤60 KB |
| Event Banner | ≤150 KB | ≤300 KB |
| OG Image | ≤100 KB | ≤200 KB |

---

## Slot Configuration (Single Source of Truth)

| Slot | Ratio | Crop Mode | Face Aware | Consent | Category |
|------|-------|-----------|------------|---------|----------|
| Hero | 4:3 | Forced | No | No | Hero |
| About | 4:3 | Forced | No | No | Hero |
| Faculty | 4:5 | Forced | **Yes** | **Yes** | Portrait |
| Gallery | Natural | Free | No | Yes | Gallery |
| Gallery Thumb | 1:1 | Forced | No | No | Thumbnail |
| Testimonial Avatar | 1:1 | Forced | Yes | Yes | Avatar |
| Result | 4:3 | Forced | No | Yes | Gallery |
| Event Banner | 16:9 | Forced | No | No | Banner |
| OG Image | 1.91:1 | Forced | No | No | Banner |
| Logo | Natural | Free | No | No | Brand |
| Favicon | 1:1 | Forced | No | No | Brand |

---

## Small/Low-Quality Images (Never Block, Always Help)

| Quality Level | Criteria | User Feedback |
|---------------|----------|---------------|
| **Good** | ≥ target pixels | "Good quality" |
| **OK** | 25-100% target pixels | "Good quality, may look slightly soft on large screens" |
| **Low** | < 25% target pixels | "Low resolution, best used at small sizes" |

- Served at natural size where space allows (CSS scales up)
- No fake detail via heavy upscaling
- Optional AI upscaler for images < 50% target size (marked "enhanced")
- Non-blocking warning for low-res in large slots
- Gentle warnings for blur/darkness, never blocking

---

## Admin Experience

### Upload Flow
1. Select slot type (tabs)
2. Drag-drop/paste/capture files (up to 50)
3. Instant placeholder cards with spinners
4. Real-time progress via polling (1s intervals)
5. Auto-swap to finished result (no reload)

### Preview & Adjustment
- Desktop/mobile preview in cropper modal
- **Adjust** button: pan/zoom within locked ratio, rotate, drag focal point
- Re-processes from stored original
- Default flow requires zero adjustment

### Required Fields
- Alt text (with slot-specific suggestion)
- Consent checkbox for student photos (Faculty, Gallery, Result, Testimonial)
- Category & caption

### Status Badges
- **Processing** (blue spinner)
- **Ready** (green)
- **Needs Attention** (yellow - with reason + Retry)
- **Failed** (red - plain-language fix)

### Media Library
- Lists all images with slot, dimensions, saved bytes, alt-text status, usage
- Filters: search, slot, status
- Bulk actions: recycle bin, permanent delete
- **Re-process All**: One-click regenerates every variant from originals
- Soft delete with Recycle Bin & restore

---

## Public Website Rules

### Image Delivery
- **Only processed variants served** - Originals never public
- `<picture>` with AVIF → WebP → JPEG fallback
- Correct `sizes` attribute per slot
- Explicit width/height or aspect-ratio (zero CLS)
- `object-fit: cover` with `object-position` from focal point
- Blur-up fade-in (disabled for `prefers-reduced-motion`)
- Lazy loading (except hero: priority + preload)

### Loading States
- Processing → shows previous image or branded placeholder
- Switches only when new variant ready
- Never publishes half-processed files
- Failed load → branded placeholder at correct ratio

### Gallery
- Preserves natural ratios in grid
- Lightbox shows full uncropped high-res variant
- Keyboard (arrows, ESC) + swipe support

---

## Reliability & Security

### Background Jobs
- Idempotent with retries (3 attempts, exponential backoff)
- Dead-letter state for repeated failures
- Processing timeouts (5 min)
- Memory limits via Sharp streaming
- Concurrency cap (3 workers)

### Security
- Authenticated & authorized upload endpoints
- Rate limited (50 req/min per IP)
- Server-side re-validation (never trust client dimensions/types/crops)
- No personal data in logs
- Temp files deleted after processing

### Minor Protection
- Consent required for Students, Events, Achievements
- One-click "Take Down" removes public variants + purges CDN cache

---

## API Endpoints

### `POST /api/admin/media`
Upload new image (returns job ID for polling)

### `GET /api/admin/media`
List assets with pagination, filters

### `PATCH /api/admin/media`
Update metadata, trigger reprocess

### `DELETE /api/admin/media`
Soft/hard delete

### `PUT /api/admin/media`
Reprocess all or specific assets

### `GET /api/admin/media/job?jobId=...`
Poll job progress (returns asset when complete)

---

## Testing

### Unit Tests (`npm test`)
- Type detection (magic bytes)
- Ratio/crop mathematics
- Size budget encoding
- Slot configuration
- Filename generation
- HEIC detection

### E2E Tests (`npm run test:e2e`)
- 40 MB phone photo uploads in <15s
- HEIC, PNG, WebP, AVIF, BMP, TIFF all work
- Wrong extension (.jpg = PNG) works; .exe rejected
- 300×200 accepted, flagged low-res, not blocked
- Panorama & tall screenshot use blurred-background fit
- Faculty photos → uniform 4:5 with faces intact
- EXIF/GPS absent from stored files (verified with exiftool)
- Public pages serve AVIF/WebP, Network tab shows small variants on mobile
- No layout shift, no broken images, hero loads first, Lighthouse ≥95
- Corrupt file shows clear error, doesn't affect batch
- "Re-process All" regenerates correctly after ratio change

---

## Acceptance Checklist

- [ ] A 40 MB phone photo uploads with no resizing by the owner and appears on the site in the right ratio in under 15 seconds
- [ ] iPhone HEIC, PNG with transparency, WebP, AVIF, BMP and TIFF all work
- [ ] A .jpg file that is really a PNG still works; a renamed .exe is rejected
- [ ] A 300×200 image is accepted, shown without distortion, and flagged as low resolution without blocking
- [ ] A wide panorama and a tall screenshot display fully (blurred-background fit) with nothing important cut off
- [ ] Faculty photos from different cameras all end up as uniform 4:5 portraits with faces intact
- [ ] GPS/EXIF data is absent from every stored file (checked with an EXIF tool)
- [ ] Public pages serve AVIF/WebP, never originals; Network tab shows small variants on mobile
- [ ] No layout shift, no broken images, hero loads first, Lighthouse mobile ≥ 95
- [ ] A corrupt file shows a clear error and does not affect other uploads in the batch
- [ ] "Re-process all" regenerates every variant correctly after a ratio change

---

## Architecture

```
lib/
├── image-processing.ts    # Core processing pipeline (Sharp)
├── image-slots.ts         # Slot configuration (single source of truth)
├── media-queue.ts         # BullMQ background worker
└── validation.ts          # Additional validation helpers

app/api/admin/media/
├── route.ts               # Upload, list, update, delete, reprocess
└── job/route.ts           # Job progress polling

components/
├── MediaUploader.tsx      # Admin upload UI with real-time progress
├── MediaLibrary.tsx       # Admin library with management
└── Picture.tsx            # Public display component
```

---

## Dependencies Added

```json
{
  "sharp": "^0.35.5",           # Image processing (libvips)
  "file-type": "^22.1.1",       # Magic byte detection
  "exif-parser": "^0.1.12",     # EXIF reading
  "blurhash": "^2.0.5",         # Blur placeholders
  "bullmq": "^5.12.0",          # Background job queue
  "ioredis": "^5.4.1"           # Redis client
}
```

---

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Optional
NEXT_PUBLIC_SITE_URL=https://brilliantminds.edu
```

---

## Deployment Notes

1. **Sharp/libvips**: Requires native dependencies. On Alpine: `apk add vips-dev`
2. **Redis**: Required for BullMQ queue (use Valkey/Redis Cloud in production)
3. **Storage**: Current implementation uses local `public/uploads/media`. For production, replace with S3-compatible storage (update `media-queue.ts` file operations)
4. **CDN**: Configure cache headers for `/uploads/media/variants/*` (immutable, 1 year)
5. **Workers**: Run `mediaWorker` in separate process or container for production

---

## Future Enhancements

- [ ] AI upscaler integration (Real-ESRGAN via replicate.com or local)
- [ ] S3/R2 storage adapter
- [ ] WebP/AVIF fallback for older browsers via service worker
- [ ] Automatic face blur for privacy compliance
- [ ] Batch PDF multi-page extraction
- [ ] Video thumbnail extraction