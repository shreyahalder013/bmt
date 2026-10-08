import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { sameOrigin } from '@/lib/csrf';

const updateSchema = z.object({ id: z.string().cuid(), status: z.enum(['new', 'contacted', 'enrolled', 'closed']).optional(), notes: z.string().trim().max(2000).optional() });

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const status = query.get('status');
  const className = query.get('class');
  const search = query.get('search')?.trim();
  const enquiries = await db.enquiry.findMany({
    where: {
      ...(status && ['new', 'contacted', 'enrolled', 'closed'].includes(status) ? { status: status as 'new' | 'contacted' | 'enrolled' | 'closed' } : {}),
      ...(className ? { class: className } : {}),
      ...(search ? { OR: [{ studentName: { contains: search, mode: 'insensitive' } }, { parentName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(enquiries);
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid enquiry update.' }, { status: 400 });
  const { id, ...data } = parsed.data;
  const enquiry = await db.enquiry.update({ where: { id }, data });
  return NextResponse.json(enquiry);
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Enquiry id is required.' }, { status: 400 });
  await db.enquiry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
