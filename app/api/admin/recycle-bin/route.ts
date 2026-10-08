import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/csrf';
import { RecycleBinEntity } from '@prisma/client';

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const items = await db.recycleBinItem.findMany({
    where: { permanentlyDeletedAt: null },
    orderBy: { deletedAt: 'desc' },
    include: { deletedBy: { select: { id: true, name: true, email: true } } },
  });
  
  return NextResponse.json(items);
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const body = await request.json().catch(() => null);
  const itemId = body?.itemId;
  const action = body?.action;
  
  if (!itemId || action !== 'restore') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  
  const item = await db.recycleBinItem.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  if (item.permanentlyDeletedAt) return NextResponse.json({ error: 'Already permanently deleted' }, { status: 400 });
  
  const type = item.entity.toLowerCase();
  const data = item.data as Record<string, unknown>;
  
  try {
    switch (type) {
      case 'enquiry':
        await db.enquiry.create({ data: data as any });
        break;
      case 'student': {
        const { guardians, enrollments, ...studentData } = data;
        await db.student.create({ data: { ...studentData, guardians: { create: guardians as any[] } } as any });
        break;
      }
      case 'batch':
        await db.batch.create({ data: data as any });
        break;
      case 'enrollment':
        await db.enrollment.create({ data: data as any });
        break;
      case 'attendance_record':
        await db.attendanceRecord.create({ data: data as any });
        break;
      case 'fee_plan': {
        const { installments, ...feePlanData } = data;
        await db.feePlan.create({ data: { ...feePlanData, installments: { create: installments as any[] } } as any });
        break;
      }
      case 'instalment':
        await db.instalment.create({ data: data as any });
        break;
      case 'payment':
        await db.payment.create({ data: data as any });
        break;
      case 'expense':
        await db.expense.create({ data: data as any });
        break;
      case 'test': {
        const { marks, ...testData } = data;
        await db.test.create({ data: { ...testData, marks: { create: marks as any[] } } as any });
        break;
      }
      case 'test_mark':
        await db.testMark.create({ data: data as any });
        break;
      case 'faculty':
        await db.faculty.create({ data: data as any });
        break;
      case 'testimonial':
        await db.testimonial.create({ data: data as any });
        break;
      case 'result':
        await db.result.create({ data: data as any });
        break;
      case 'gallery_item':
        await db.galleryItem.create({ data: data as any });
        break;
      case 'announcement':
        await db.announcement.create({ data: data as any });
        break;
      default:
        return NextResponse.json({ error: 'Unknown entity type' }, { status: 400 });
    }
    
    await db.recycleBinItem.update({
      where: { id: itemId },
      data: { permanentlyDeletedAt: new Date() },
    });
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Restore failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const body = await request.json().catch(() => null);
  const itemId = body?.itemId;
  
  if (!itemId) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
  
  await db.recycleBinItem.update({
    where: { id: itemId },
    data: { permanentlyDeletedAt: new Date() },
  });
  
  return NextResponse.json({ ok: true });
}