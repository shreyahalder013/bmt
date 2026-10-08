import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FacultyStatus } from '@prisma/client';
export const revalidate = 60;
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const [faculty, gallery] = await Promise.all([db.faculty.findMany({ where: { status: FacultyStatus.PUBLISHED, deletedAt: null }, orderBy: { order: 'asc' }, select: { id: true, slug: true, displayName: true, fullName: true, title: true, role: true, shortBio: true, fullBio: true, qualifications: true, experienceYears: true, languages: true, specialities: true, achievements: true, subjects: true, classLevels: true, socialLinks: true, publicFields: true, contactEmail: true, contactPhone: true, photoAssetId: true, photoAlt: true, featured: true, order: true } }), db.galleryItem.findMany({ where: { published: true }, orderBy: { order: 'asc' }, select: { id: true, imageUrl: true, caption: true, category: true, altText: true } })]);
    return NextResponse.json({ faculty, gallery }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ faculty: [], gallery: [] }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
