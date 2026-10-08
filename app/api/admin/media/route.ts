import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/csrf';
import { limited } from '@/lib/rate-limit';
import { validateImageFile, preprocessFile, isHeic } from '@/lib/image-processing';
import { ImageSlotKey, getSlotConfig } from '@/lib/image-slots';
import { MediaSlot, ConsentStatus, MediaStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { addMediaJob, mediaQueue } from '@/lib/media-queue';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || 'dev-secret';
const REVALIDATION_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function triggerRevalidation(paths: string[]) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/revalidate`, {
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

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'media');
const PUBLIC_UPLOAD_URL = '/uploads/media';

import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'temp'), { recursive: true });
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

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (limited(`media-upload:${ip}`, 50)) {
    return NextResponse.json({ error: 'Too many upload requests. Please wait a moment.' }, { status: 429 });
  }

  await ensureUploadDir();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const slotKey = formData.get('slot') as string;
    const altText = (formData.get('altText') as string)?.trim() || '';
    const caption = (formData.get('caption') as string)?.trim() || '';
    const isDecorative = formData.get('isDecorative') === 'true';
    const consentGranted = formData.get('consentGranted') === 'true';
    const cropData = formData.get('cropData') ? JSON.parse(formData.get('cropData') as string) : null;
    const focalPoint = formData.get('focalPoint') ? JSON.parse(formData.get('focalPoint') as string) : null;
    const replaceId = formData.get('replaceId') as string | null;

    if (!file || !slotKey) {
      return NextResponse.json({ error: 'File and slot are required.' }, { status: 400 });
    }

    // Validate slot
    const slotConfig = getSlotConfig(slotKey as ImageSlotKey);
    if (!slotConfig) {
      return NextResponse.json({ error: 'Invalid image slot.' }, { status: 400 });
    }

    // Check required fields
    if (slotConfig.altRequired && !isDecorative && !altText) {
      return NextResponse.json({ error: 'Alt text is required for this image slot.' }, { status: 400 });
    }

    if (slotConfig.requiresConsent && !consentGranted) {
      return NextResponse.json({ error: 'Consent is required for this image slot. Please confirm you have permission to publish this photo.' }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);

    // Detect file type from magic bytes
    const fileType = await import('file-type').then(m => m.fileTypeFromBuffer(buffer));
    if (!fileType) {
      return NextResponse.json({ error: 'Unable to determine file type. Please upload a valid image.' }, { status: 400 });
    }

    const detectedMime = fileType.mime;

    // Check for dangerous files
    const DANGEROUS_EXTENSIONS = new Set([
      'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'js', 'jar', 'sh', 'py',
      'rb', 'pl', 'php', 'asp', 'aspx', 'jsp', 'html', 'htm', 'xml', 'zip',
      'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dll', 'so', 'dylib', 'bin',
      'app', 'deb', 'rpm', 'apk', 'ipa',
    ]);

    if (DANGEROUS_EXTENSIONS.has(fileType.ext)) {
      return NextResponse.json({
        error: "This file can't be used as a photo. Please upload a JPG, PNG, HEIC, WebP or PDF."
      }, { status: 400 });
    }

    // Quick validation - just check size and basic type
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds maximum 50 MB.' }, { status: 400 });
    }

    // Handle HEIC conversion upfront for validation
    if (isHeic(buffer)) {
      try {
        buffer = await preprocessFile(buffer, detectedMime);
      } catch {
        return NextResponse.json({ error: 'HEIC format not supported for conversion. Please convert to JPEG before uploading.' }, { status: 400 });
      }
    }

    // Create asset record with PROCESSING status immediately
    const assetId = uuidv4();
    const slotEnum = mapSlotToPrisma(slotKey);
    const consentStatus = mapConsentStatus(slotConfig.requiresConsent, consentGranted);

    // Save original file to temp storage for processing
    const tempFilename = `${assetId}-${Date.now()}.tmp`;
    const tempPath = join(UPLOAD_DIR, 'temp', tempFilename);
    await writeFile(tempPath, buffer);

    // Create asset record
    const asset = await db.mediaAsset.create({
      data: {
        id: assetId,
        slot: slotEnum,
        originalFilename: file.name,
        originalWidth: 0, // Will be updated after processing
        originalHeight: 0,
        originalSize: buffer.length,
        mimeType: detectedMime,
        ratioWidth: slotConfig.aspectRatio.width,
        ratioHeight: slotConfig.aspectRatio.height,
        cropX: cropData?.x,
        cropY: cropData?.y,
        cropWidth: cropData?.width,
        cropHeight: cropData?.height,
        focalX: focalPoint?.x,
        focalY: focalPoint?.y,
        altText: isDecorative ? '' : altText,
        caption,
        isDecorative,
        consentStatus,
        consentGivenAt: consentGranted ? new Date() : null,
        status: MediaStatus.PROCESSING,
        uploadedById: (() => { const v = request.headers.get('x-user-id'); return v ?? undefined; })(),
      },
    });

    // Queue background processing job
    const job = await addMediaJob({
      assetId: asset.id,
      fileBuffer: buffer,
      originalFilename: file.name,
      slot: slotKey,
      mimeType: detectedMime,
      cropData: cropData ? {
        x: cropData.x,
        y: cropData.y,
        width: cropData.width,
        height: cropData.height,
        focalX: cropData.focalX,
        focalY: cropData.focalY,
      } : undefined,
      focalPoint,
      altText,
      caption,
      isDecorative,
      consentGranted,
      uploadedById: (() => { const v = request.headers.get('x-user-id'); return v ?? undefined; })(),
      backgroundColor: '#ffffff',
      isLogo: slotKey === 'logo' || slotKey === 'favicon',
      replaceId: replaceId ?? undefined,
    });

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        slot: asset.slot,
        status: asset.status,
        jobId: job.id,
      },
      message: 'Upload received. Processing started.',
    }, { status: 201 });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const slot = request.nextUrl.searchParams.get('slot');
  const status = request.nextUrl.searchParams.get('status');
  const search = request.nextUrl.searchParams.get('search');
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  const sort = request.nextUrl.searchParams.get('sort') || 'createdAt';
  const order = request.nextUrl.searchParams.get('order') || 'desc';

  const where: any = { deletedAt: null };

  if (slot) {
    where.slot = slot.toUpperCase();
  }

  if (status) {
    where.status = status.toUpperCase();
  }

  if (search) {
    where.OR = [
      { altText: { contains: search, mode: 'insensitive' } },
      { caption: { contains: search, mode: 'insensitive' } },
      { originalFilename: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [assets, total] = await Promise.all([
    db.mediaAsset.findMany({
      where,
      include: { variants: true },
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.mediaAsset.count({ where }),
  ]);

  return NextResponse.json({
    assets: assets.map(asset => ({
      id: asset.id,
      slot: asset.slot,
      originalFilename: asset.originalFilename,
      originalWidth: asset.originalWidth,
      originalHeight: asset.originalHeight,
      originalSize: asset.originalSize,
      altText: asset.altText,
      caption: asset.caption,
      isDecorative: asset.isDecorative,
      consentStatus: asset.consentStatus,
      status: asset.status,
      blurDataURL: asset.blurDataURL,
      dominantColor: asset.dominantColor,
      cropX: asset.cropX,
      cropY: asset.cropY,
      cropWidth: asset.cropWidth,
      cropHeight: asset.cropHeight,
      focalX: asset.focalX,
      focalY: asset.focalY,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      variants: asset.variants.map(v => ({
        id: v.id,
        width: v.width,
        height: v.height,
        format: v.format,
        size: v.size,
        url: v.url,
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const altText = body?.altText?.trim();
  const caption = body?.caption?.trim();
  const isDecorative = body?.isDecorative;
  const consentGranted = body?.consentGranted;
  const cropData = body?.cropData;
  const focalPoint = body?.focalPoint;
  const reprocess = body?.reprocess === true;

  if (!id) {
    return NextResponse.json({ error: 'Asset ID is required.' }, { status: 400 });
  }

  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  const slotConfig = getSlotConfig(asset.slot.toLowerCase() as ImageSlotKey);

  if (altText !== undefined) {
    if (slotConfig.altRequired && !isDecorative && !altText) {
      return NextResponse.json({ error: 'Alt text is required for this image slot.' }, { status: 400 });
    }
  }

  if (consentGranted !== undefined && slotConfig.requiresConsent && !consentGranted) {
    return NextResponse.json({ error: 'Consent is required for this image slot.' }, { status: 400 });
  }

  // If reprocess requested or crop/focal point changed, queue reprocessing
  if (reprocess || cropData || focalPoint) {
    // Get original file from storage
    // In production, fetch from object storage
    const originalPath = join(UPLOAD_DIR, 'originals', `original-${asset.id}.${asset.originalFilename.split('.').pop()}`);
    
    // For now, we'll need to re-upload the file or have it stored
    // This is a simplified version - in production you'd fetch from S3/etc.
    const { readFile } = await import('fs/promises');
    let originalBuffer: Buffer;
    try {
      originalBuffer = await readFile(originalPath);
    } catch {
      return NextResponse.json({ error: 'Original file not found for reprocessing.' }, { status: 404 });
    }

    const job = await addMediaJob({
      assetId: asset.id,
      fileBuffer: originalBuffer,
      originalFilename: asset.originalFilename,
      slot: asset.slot.toLowerCase(),
      mimeType: asset.mimeType,
      cropData: cropData || (asset.cropX !== null ? {
        x: asset.cropX!,
        y: asset.cropY!,
        width: asset.cropWidth!,
        height: asset.cropHeight!,
      } : undefined),
      focalPoint: focalPoint || (asset.focalX !== null ? { x: asset.focalX!, y: asset.focalY! } : undefined),
      altText: asset.altText || '',
      caption: asset.caption || '',
      isDecorative: asset.isDecorative,
      consentGranted: asset.consentStatus === 'GRANTED',
      uploadedById: asset.uploadedById ?? undefined,
      backgroundColor: '#ffffff',
      isLogo: asset.slot === 'LOGO' || asset.slot === 'FAVICON',
      replaceId: asset.id,
    });

    // Update status to processing
    await db.mediaAsset.update({
      where: { id: asset.id },
      data: { status: MediaStatus.PROCESSING },
    });

    return NextResponse.json({
      success: true,
      asset: { id: asset.id, status: 'PROCESSING' },
      jobId: job.id,
      message: 'Reprocessing started.',
    });
  }

  const updated = await db.mediaAsset.update({
    where: { id },
    data: {
      altText: isDecorative ? '' : (altText ?? asset.altText),
      caption: caption ?? asset.caption,
      isDecorative: isDecorative ?? asset.isDecorative,
      consentStatus: consentGranted ? ConsentStatus.GRANTED : (consentGranted === false ? ConsentStatus.DENIED : asset.consentStatus),
      consentGivenAt: consentGranted && !asset.consentGivenAt ? new Date() : asset.consentGivenAt,
      consentWithdrawnAt: consentGranted === false && asset.consentStatus === 'GRANTED' ? new Date() : asset.consentWithdrawnAt,
    },
    include: { variants: true },
  });

  // Trigger revalidation for paths that use this media
  const revalidationPaths = getRevalidationPathsForSlot(asset.slot);
  await triggerRevalidation(revalidationPaths);

  return NextResponse.json({
    success: true,
    asset: {
      id: updated.id,
      altText: updated.altText,
      caption: updated.caption,
      isDecorative: updated.isDecorative,
      consentStatus: updated.consentStatus,
    },
  });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  if (!id) {
    return NextResponse.json({ error: 'Asset ID is required.' }, { status: 400 });
  }

  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  const slot = asset.slot;

  if (permanent) {
    // Hard delete - remove files too
    await db.mediaVariant.deleteMany({ where: { assetId: id } });
    await db.mediaAsset.delete({ where: { id } });
    // Note: In production, also delete files from storage
    await triggerRevalidation(getRevalidationPathsForSlot(slot));
    return NextResponse.json({ ok: true, message: 'Permanently deleted.' });
  } else {
    // Soft delete
    await db.mediaAsset.update({
      where: { id },
      data: {
        status: MediaStatus.DELETED,
        deletedAt: new Date(),
      },
    });
    await triggerRevalidation(getRevalidationPathsForSlot(slot));
    return NextResponse.json({ ok: true, message: 'Moved to recycle bin.' });
  }
}

// Reprocess all endpoint
export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const assetIds = body?.assetIds as string[] | undefined;

  if (assetIds && assetIds.length > 0) {
    // Reprocess specific assets
    for (const assetId of assetIds) {
      const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
      if (asset) {
        const originalPath = join(UPLOAD_DIR, 'originals', `original-${asset.id}.${asset.originalFilename.split('.').pop()}`);
        const { readFile } = await import('fs/promises');
        try {
          const originalBuffer = await readFile(originalPath);
          await addMediaJob({
            assetId: asset.id,
            fileBuffer: originalBuffer,
            originalFilename: asset.originalFilename,
            slot: asset.slot.toLowerCase(),
            mimeType: asset.mimeType,
            cropData: asset.cropX !== null ? {
              x: asset.cropX!,
              y: asset.cropY!,
              width: asset.cropWidth!,
              height: asset.cropHeight!,
            } : undefined,
            focalPoint: asset.focalX !== null ? { x: asset.focalX!, y: asset.focalY! } : undefined,
            altText: asset.altText || '',
            caption: asset.caption || '',
            isDecorative: asset.isDecorative,
            consentGranted: asset.consentStatus === 'GRANTED',
            uploadedById: asset.uploadedById ?? undefined,
            backgroundColor: '#ffffff',
            isLogo: asset.slot === 'LOGO' || asset.slot === 'FAVICON',
            replaceId: asset.id,
          });

          await db.mediaAsset.update({
            where: { id: asset.id },
            data: { status: MediaStatus.PROCESSING },
          });
        } catch {
          console.error(`Failed to queue reprocess for ${assetId}`);
        }
      }
    }
    return NextResponse.json({ success: true, message: `Queued ${assetIds.length} assets for reprocessing.` });
  } else {
    // Reprocess all
    const { reprocessAllAssets } = await import('@/lib/media-queue');
    const result = await reprocessAllAssets();
    // Revalidate all paths that might use media
    await triggerRevalidation(['/', '/faculty', '/api/media', '/api/faculty', '/about', '/events', '/results']);
    return NextResponse.json({ success: true, message: `Queued ${result.queued} assets for reprocessing.` });
  }
}