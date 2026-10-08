import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enquirySchema } from '@/lib/validation';
import { limited } from '@/lib/rate-limit';
import nodemailer from 'nodemailer';
import { sameOrigin } from '@/lib/csrf';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (limited(ip)) return NextResponse.json({ error: 'Too many enquiries from this connection. Please try again later or call 087379 14988.' }, { status: 429 });
  const parsed = enquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.website) return NextResponse.json({ error: 'Please check the highlighted fields and try again.' }, { status: 400 });
  const { website: _website, ...data } = parsed.data;
  let enquiry;
  try {
    enquiry = await db.enquiry.create({ data });
  } catch {
    return NextResponse.json({ error: 'The enquiry service is temporarily unavailable. Please call 087379 14988 directly.' }, { status: 503 });
  }
  if (process.env.SMTP_HOST && process.env.OWNER_EMAIL) {
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
    await transport.sendMail({ from: process.env.SMTP_FROM, to: process.env.OWNER_EMAIL, subject: `New enquiry from ${data.parentName}`, text: JSON.stringify(data, null, 2) });
  }
  return NextResponse.json({ ok: true, id: enquiry.id, contactPhone: '087379 14988' }, { status: 201 });
}
