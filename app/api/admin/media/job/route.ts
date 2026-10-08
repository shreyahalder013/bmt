import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/csrf';
import { getJobProgress } from '@/lib/media-queue';
import { db } from '@/lib/db';
import { MediaStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const jobId = request.nextUrl.searchParams.get('jobId');
  const assetId = request.nextUrl.searchParams.get('assetId');

  if (jobId) {
    const progress = await getJobProgress(jobId);
    if (!progress) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    // If job completed, fetch the updated asset
    let asset = null;
    if (progress.state === 'completed' && progress.returnvalue?.assetId) {
      asset = await db.mediaAsset.findUnique({
        where: { id: progress.returnvalue.assetId },
        include: { variants: true },
      });
    }

    return NextResponse.json({
      job: progress,
      asset,
    });
  }

  if (assetId) {
    const asset = await db.mediaAsset.findUnique({
      where: { id: assetId },
      include: { variants: true },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
    }

    return NextResponse.json({
      asset: {
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
      },
    });
  }

  return NextResponse.json({ error: 'jobId or assetId required.' }, { status: 400 });
}