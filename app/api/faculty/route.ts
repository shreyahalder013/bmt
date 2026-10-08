import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FacultyStatus } from '@prisma/client';

export async function GET() {
  try {
    const faculty = await db.faculty.findMany({
      where: {
        status: FacultyStatus.PUBLISHED,
        deletedAt: null,
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        slug: true,
        displayName: true,
        fullName: true,
        title: true,
        role: true,
        shortBio: true,
        fullBio: true,
        qualifications: true,
        experienceYears: true,
        languages: true,
        specialities: true,
        achievements: true,
        subjects: true,
        classLevels: true,
        socialLinks: true,
        publicFields: true,
        contactEmail: true,
        contactPhone: true,
        photoAssetId: true,
        photoAlt: true,
        featured: true,
        order: true,
      },
    });

    return NextResponse.json({ faculty }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ faculty: [] }, { status: 200 });
  }
}