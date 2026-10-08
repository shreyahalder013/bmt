import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/csrf';
import { FacultyStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const bulkActionSchema = z.object({
  action: z.enum(['publish', 'hide', 'draft', 'delete', 'reorder', 'feature', 'unfeature']),
  ids: z.array(z.string().cuid()).min(1),
  order: z.array(z.object({ id: z.string().cuid(), order: z.number().int() })).optional(),
});

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const userId = request.headers.get('x-user-id') || undefined;
  const userRole = request.headers.get('x-user-role') || 'STAFF';

  const body = await request.json().catch(() => null);
  const result = bulkActionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Validation failed', issues: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { action, ids, order } = result.data;

  // Check permissions
  if (userRole === 'TEACHER') {
    return NextResponse.json({ error: 'Teachers cannot perform bulk actions.' }, { status: 403 });
  }
  if (userRole === 'STAFF' && (action === 'delete' || action === 'publish')) {
    return NextResponse.json({ error: 'Only owners can publish or delete teachers.' }, { status: 403 });
  }

  const faculty = await db.faculty.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, displayName: true, status: true, photoAssetId: true, photoAlt: true, consentAt: true },
  });

  if (faculty.length !== ids.length) {
    return NextResponse.json({ error: 'Some teachers not found.' }, { status: 404 });
  }

  let updatedCount = 0;
  const errors: string[] = [];

  switch (action) {
    case 'publish': {
      for (const f of faculty) {
        if (!f.photoAssetId || !f.photoAlt || !f.consentAt) {
          errors.push(`${f.displayName}: Missing photo, alt text, or consent.`);
          continue;
        }
        await db.faculty.update({
          where: { id: f.id },
          data: { status: FacultyStatus.PUBLISHED },
        });
        updatedCount++;
      }
      break;
    }
    case 'hide': {
      await db.faculty.updateMany({
        where: { id: { in: ids } },
        data: { status: FacultyStatus.HIDDEN },
      });
      updatedCount = ids.length;
      break;
    }
    case 'draft': {
      await db.faculty.updateMany({
        where: { id: { in: ids } },
        data: { status: FacultyStatus.DRAFT },
      });
      updatedCount = ids.length;
      break;
    }
    case 'feature': {
      await db.faculty.updateMany({
        where: { id: { in: ids } },
        data: { featured: true },
      });
      updatedCount = ids.length;
      break;
    }
    case 'unfeature': {
      await db.faculty.updateMany({
        where: { id: { in: ids } },
        data: { featured: false },
      });
      updatedCount = ids.length;
      break;
    }
    case 'delete': {
      // Check for linked batches
      const linkedBatches = await db.facultyBatch.groupBy({
        by: ['facultyId'],
        where: { facultyId: { in: ids } },
        _count: { id: true },
      });

      for (const link of linkedBatches) {
        const f = faculty.find(f => f.id === link.facultyId);
        if (f) errors.push(`${f.displayName}: Linked to ${link._count.id} batch(es).`);
      }

      const deletableIds = faculty.filter(f => !linkedBatches.some(l => l.facultyId === f.id)).map(f => f.id);
      
      if (deletableIds.length > 0) {
        await db.faculty.updateMany({
          where: { id: { in: deletableIds } },
          data: { deletedAt: new Date(), status: FacultyStatus.HIDDEN },
        });
        
        // Add to recycle bin
        const deletedFaculty = faculty.filter(f => deletableIds.includes(f.id));
        await db.recycleBinItem.createMany({
          data: deletedFaculty.map(f => ({
            entity: 'FACULTY',
            entityId: f.id,
            data: f as Prisma.InputJsonValue,
            deletedById: userId,
          })),
        });
        
        updatedCount = deletableIds.length;
      }
      break;
    }
    case 'reorder': {
      if (!order || order.length !== ids.length) {
        return NextResponse.json({ error: 'Reorder requires order array with all IDs.' }, { status: 400 });
      }
      
      await db.$transaction(
        order.map(({ id, order: newOrder }) =>
          db.faculty.update({ where: { id }, data: { order: newOrder } })
        )
      );
      updatedCount = ids.length;
      break;
    }
  }

  // Audit log for bulk action
  await db.auditLog.create({
    data: {
      userId,
      action: `BULK_${action.toUpperCase()}`,
      entity: 'FACULTY',
      entityId: ids[0],
      metadata: { ids, count: updatedCount, errors } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ success: true, updated: updatedCount, errors });
}