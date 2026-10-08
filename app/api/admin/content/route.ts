import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { sameOrigin } from '@/lib/csrf';

const kindSchema = z.enum(['classes', 'faculty', 'results', 'testimonials', 'gallery', 'announcements', 'settings']);
const modelFor = { classes: 'classProgram', faculty: 'faculty', results: 'result', testimonials: 'testimonial', gallery: 'galleryItem', announcements: 'announcement', settings: 'siteSettings' } as const;
const payload = z.object({ kind: kindSchema, id: z.string().optional(), data: z.record(z.string(), z.unknown()) });

export async function GET(request: NextRequest) {
  const kind = kindSchema.safeParse(request.nextUrl.searchParams.get('kind'));
  if (!kind.success) return NextResponse.json({ error: 'Unknown content type.' }, { status: 400 });
  const delegate = db[modelFor[kind.data]] as unknown as { findMany: (args: object) => Promise<unknown>; findUnique: (args: object) => Promise<unknown> };
  const data = kind.data === 'settings' ? await delegate.findUnique({ where: { id: 'site' } }) : await delegate.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid content form.' }, { status: 400 });
  const { kind, data } = parsed.data;
  const delegate = db[modelFor[kind]] as unknown as { create: (args: object) => Promise<unknown>; upsert: (args: object) => Promise<unknown> };
  const saved = kind === 'settings' ? await delegate.upsert({ where: { id: 'site' }, update: data, create: { id: 'site', ...data } }) : await delegate.create({ data });
  return NextResponse.json(saved, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const parsed = payload.extend({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid content update.' }, { status: 400 });
  const delegate = db[modelFor[parsed.data.kind]] as unknown as { update: (args: object) => Promise<unknown> };
  return NextResponse.json(await delegate.update({ where: { id: parsed.data.id }, data: parsed.data.data }));
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const kind = kindSchema.safeParse(request.nextUrl.searchParams.get('kind'));
  const id = request.nextUrl.searchParams.get('id');
  if (!kind.success || !id || kind.data === 'settings') return NextResponse.json({ error: 'Invalid content delete.' }, { status: 400 });
  const delegate = db[modelFor[kind.data]] as unknown as { delete: (args: object) => Promise<unknown> };
  await delegate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
