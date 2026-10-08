import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '@/lib/db';
import { processImageVariants, preprocessFile, validateImageFile } from '@/lib/image-processing';
import { MediaSlot, MediaStatus, ConsentStatus } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getSlotConfig } from '@/lib/image-slots';
import crypto from 'crypto';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export const mediaQueue = new Queue('media-processing', { connection });

mediaQueue.on('error', (err) => {
  console.error('Media queue error:', err);
});

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'media');
const PUBLIC_UPLOAD_URL = '/uploads/media';

// Revalidation endpoint URL
const REVALIDATION_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || 'dev-secret';

async function triggerRevalidation(paths: string[]) {
  try {
    await fetch(`${REVALIDATION_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${REVALIDATION_SECRET}`,
      },
      body: JSON.stringify({ paths }),
    });
  } catch (error) {
    console.error('Revalidation failed:', error);
  }
}

async function computeContentHash(buffer: Buffer): Promise<string> {
  return crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
}

interface MediaJobData {
  assetId: string;
  fileBuffer: Buffer; // In production, store in temp storage and pass path
  originalFilename: string;
  slot: string;
  mimeType: string;
  cropData?: { x: number; y: number; width: number; height: number; focalX?: number; focalY?: number };
  focalPoint?: { x: number; y: number };
  altText: string;
  caption: string;
  isDecorative: boolean;
  consentGranted: boolean;
  uploadedById?: string;
  backgroundColor?: string;
  isLogo?: boolean;
  replaceId?: string;
}

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'originals'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'variants'), { recursive: true });
  } catch {
    // Directory might already exist
  }
}

function mapSlotToPrisma(slotKey: string): MediaSlot {
  const mapping: Record<string, MediaSlot> = {
    hero: 'HERO',
    about: 'ABOUT',
    faculty: 'FACULTY',
    gallery: 'GALLERY',
    'gallery-thumbnail': 'GALLERY_THUMBNAIL',
    'testimonial-avatar': 'TESTIMONIAL_AVATAR',
    result: 'RESULT',
    'event-banner': 'EVENT_BANNER',
    'og-image': 'OG_IMAGE',
    logo: 'LOGO',
    favicon: 'FAVICON',
  };
  return mapping[slotKey] || 'GALLERY';
}

function mapConsentStatus(required: boolean, granted: boolean): ConsentStatus {
  if (!required) return ConsentStatus.NOT_REQUIRED;
  if (granted) return ConsentStatus.GRANTED;
  return ConsentStatus.PENDING;
}

const processor = async (job: Job<MediaJobData>) => {
  const data = job.data;
  const slotConfig = getSlotConfig(data.slot as any);

  await job.updateProgress(10);

  try {
    // Update status to processing
    await db.mediaAsset.update({
      where: { id: data.assetId },
      data: { status: MediaStatus.PROCESSING },
    });

    await job.updateProgress(20);

    // Preprocess file (HEIC, PDF, SVG, RAW, GIF)
    let processedBuffer = await preprocessFile(data.fileBuffer, data.mimeType);

    await job.updateProgress(40);

    // Validate
    const validation = await validateImageFile(processedBuffer, data.slot as any);
    if (!validation.valid) {
      throw new Error(validation.error || 'Validation failed');
    }

    await job.updateProgress(50);

    // Process image variants
    const result = await processImageVariants(processedBuffer, {
      slot: data.slot as any,
      crop: data.cropData,
      focalPoint: data.focalPoint,
      generateVariants: true,
      backgroundColor: data.backgroundColor,
      isLogo: data.isLogo,
    });

    await job.updateProgress(70);

    // Save original
    const originalFilename = `original-${data.assetId}.${data.originalFilename.split('.').pop()?.toLowerCase() || 'jpg'}`;
    const originalPath = join(UPLOAD_DIR, 'originals', originalFilename);
    const originalUrl = `${PUBLIC_UPLOAD_URL}/originals/${originalFilename}`;

    await ensureUploadDir();
    await mkdir(join(UPLOAD_DIR, 'originals'), { recursive: true });
    await writeFile(originalPath, result.original.buffer);

    await job.updateProgress(80);

    // Save variants
    const variantRecords = [];
    const revalidationPaths = new Set<string>();

    for (const variant of result.variants) {
      // Include content hash in filename for cache busting
      const contentHash = await computeContentHash(variant.buffer);
      const variantFilename = `${data.assetId}-${variant.width}w-${contentHash}.${variant.format}`;
      const variantDir = join(UPLOAD_DIR, 'variants', variant.format);
      const variantPath = join(variantDir, variantFilename);
      const variantUrl = `${PUBLIC_UPLOAD_URL}/variants/${variant.format}/${variantFilename}`;

      await mkdir(variantDir, { recursive: true });
      await writeFile(variantPath, variant.buffer);

      variantRecords.push({
        width: variant.width,
        height: variant.height,
        size: variant.size,
        format: variant.format,
        url: variantUrl,
      });

      // Track paths that need revalidation based on slot
      const slotPaths = getRevalidationPathsForSlot(data.slot);
      slotPaths.forEach(p => revalidationPaths.add(p));
    }

    await job.updateProgress(90);

    // Update database with results
    const slotEnum = mapSlotToPrisma(data.slot);
    const consentStatus = mapConsentStatus(slotConfig.requiresConsent, data.consentGranted);

    if (data.replaceId) {
      // Replace existing asset
      await db.mediaVariant.deleteMany({ where: { assetId: data.replaceId } });

      await db.mediaAsset.update({
        where: { id: data.replaceId },
        data: {
          originalFilename: data.originalFilename,
          originalWidth: result.original.width,
          originalHeight: result.original.height,
          originalSize: result.original.size,
          mimeType: validation.mimeType || data.mimeType,
          ratioWidth: slotConfig.aspectRatio.width,
          ratioHeight: slotConfig.aspectRatio.height,
          cropX: result.cropData?.x,
          cropY: result.cropData?.y,
          cropWidth: result.cropData?.width,
          cropHeight: result.cropData?.height,
          focalX: data.focalPoint?.x ?? result.cropData?.focalX,
          focalY: data.focalPoint?.y ?? result.cropData?.focalY,
          altText: data.isDecorative ? '' : data.altText,
          caption: data.caption,
          isDecorative: data.isDecorative,
          consentStatus,
          consentGivenAt: data.consentGranted ? new Date() : null,
          blurDataURL: result.original.blurDataURL,
          dominantColor: result.original.dominantColor,
          status: MediaStatus.READY,
          variants: {
            create: variantRecords.map(v => ({
              width: v.width,
              height: v.height,
              size: v.size,
              format: v.format,
              url: v.url,
            })),
          },
        },
      });
    } else {
      // Update the asset created during upload
      await db.mediaAsset.update({
        where: { id: data.assetId },
        data: {
          originalWidth: result.original.width,
          originalHeight: result.original.height,
          originalSize: result.original.size,
          mimeType: validation.mimeType || data.mimeType,
          ratioWidth: slotConfig.aspectRatio.width,
          ratioHeight: slotConfig.aspectRatio.height,
          cropX: result.cropData?.x,
          cropY: result.cropData?.y,
          cropWidth: result.cropData?.width,
          cropHeight: result.cropData?.height,
          focalX: data.focalPoint?.x ?? result.cropData?.focalX,
          focalY: data.focalPoint?.y ?? result.cropData?.focalY,
          altText: data.isDecorative ? '' : data.altText,
          caption: data.caption,
          isDecorative: data.isDecorative,
          consentStatus,
          consentGivenAt: data.consentGranted ? new Date() : null,
          blurDataURL: result.original.blurDataURL,
          dominantColor: result.original.dominantColor,
          status: MediaStatus.READY,
          variants: {
            create: variantRecords.map(v => ({
              width: v.width,
              height: v.height,
              size: v.size,
              format: v.format,
              url: v.url,
            })),
          },
        },
      });
    }

    await job.updateProgress(100);

    // Trigger revalidation of public paths that use this media
    if (revalidationPaths.size > 0) {
      await triggerRevalidation(Array.from(revalidationPaths));
    }

    return {
      success: true,
      assetId: data.assetId,
      warnings: result.warnings,
      qualityNote: result.qualityNote,
      faceDetected: result.faceDetected,
    };
  } catch (error) {
    // Mark as failed
    await db.mediaAsset.update({
      where: { id: data.assetId },
      data: {
        status: MediaStatus.FAILED,
      },
    });

    throw error;
  }
};

export const mediaWorker = new Worker('media-processing', processor, {
  connection,
  concurrency: 3, // Limit concurrent processing
  limiter: {
    max: 10,
    duration: 60000, // 10 jobs per minute max
  },
});

mediaWorker.on('completed', (job) => {
  console.log(`Media job ${job.id} completed for asset ${job.data.assetId}`);
});

mediaWorker.on('failed', (job, err) => {
  console.error(`Media job ${job?.id} failed:`, err);
});

mediaWorker.on('error', (err) => {
  console.error('Media worker error:', err);
});

function getRevalidationPathsForSlot(slot: string): string[] {
  const slotToPaths: Record<string, string[]> = {
    hero: ['/', '/api/media'],
    about: ['/', '/about', '/api/media'],
    faculty: ['/', '/faculty', '/api/media', '/api/faculty'],
    gallery: ['/', '/faculty', '/api/media', '/api/faculty'],
    'gallery-thumbnail': ['/', '/faculty', '/api/media', '/api/faculty'],
    'testimonial-avatar': ['/', '/api/media'],
    result: ['/', '/results', '/api/media'],
    'event-banner': ['/', '/events', '/api/media'],
    'og-image': ['/api/media'],
    logo: ['/', '/api/media'],
    favicon: ['/api/media'],
  };
  return slotToPaths[slot] || ['/api/media'];
}

export async function addMediaJob(data: MediaJobData) {
  return mediaQueue.add('process', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function getJobProgress(jobId: string) {
  const job = await mediaQueue.getJob(jobId);
  if (!job) return null;

  const progress = job.progress;
  const state = await job.getState();

  return {
    id: job.id,
    progress: typeof progress === 'number' ? progress : 0,
    state,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

export async function reprocessAllAssets() {
  const assets = await db.mediaAsset.findMany({
    where: { deletedAt: null },
    select: { id: true, slot: true },
  });

  for (const asset of assets) {
    await mediaQueue.add('reprocess', { assetId: asset.id }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: 50,
      removeOnFail: 25,
    });
  }

  return { queued: assets.length };
}