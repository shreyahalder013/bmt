import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/csrf';
import { limited } from '@/lib/rate-limit';
import { FacultyStatus, EmploymentStatus, FacultyTitle, Prisma } from '@prisma/client';
import { z } from 'zod';

const facultySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  displayName: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(1).max(100),
  title: z.enum(['MR', 'MS', 'MRS', 'DR', 'SIR', 'MADAM', 'NONE']).default('NONE'),
  role: z.string().trim().min(1).max(100),
  shortBio: z.string().trim().max(200).optional().nullable(),
  fullBio: z.string().trim().max(5000).optional().nullable(),
  qualifications: z.string().trim().max(500).optional().nullable(),
  experienceYears: z.coerce.number().int().min(0).max(100).optional().nullable(),
  languages: z.string().trim().max(200).optional().nullable(),
  specialities: z.array(z.string().trim().max(100)).default([]),
  achievements: z.array(z.object({ text: z.string().trim().max(500), year: z.coerce.number().int().min(1900).max(2100).optional() })).default([]),
  subjects: z.array(z.string().trim().max(100)).default([]),
  classLevels: z.array(z.string().trim().max(50)).default([]),
  socialLinks: z.object({ linkedin: z.string().url().optional().nullable(), youtube: z.string().url().optional().nullable(), instagram: z.string().url().optional().nullable() }).default({}),
  publicFields: z.object({ email: z.boolean().default(false), phone: z.boolean().default(false) }).default({ email: false, phone: false }),
  contactEmail: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  contactPhone: z.string().trim().regex(/^(?:\+91|91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number.').optional().nullable(),
  internalNotes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['PUBLISHED', 'DRAFT', 'HIDDEN', 'PENDING_APPROVAL']).default('DRAFT'),
  featured: z.boolean().default(false),
  order: z.coerce.number().int().min(0).default(0),
  consentAt: z.coerce.date().optional().nullable(),
  consentBy: z.string().optional().nullable(),
  photoAssetId: z.string().cuid().optional().nullable(),
  photoAlt: z.string().trim().max(180).optional().nullable(),
  photoFocalX: z.coerce.number().min(0).max(1).optional().nullable(),
  photoFocalY: z.coerce.number().min(0).max(1).optional().nullable(),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'FORMER']).default('ACTIVE'),
  joinedAt: z.coerce.date().optional().nullable(),
  batchIds: z.array(z.string().cuid()).optional().default([]),
});

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const search = request.nextUrl.searchParams.get('search') || '';
  const status = request.nextUrl.searchParams.get('status') as FacultyStatus | null;
  const subject = request.nextUrl.searchParams.get('subject') || '';
  const classLevel = request.nextUrl.searchParams.get('classLevel') || '';
  const employmentStatus = request.nextUrl.searchParams.get('employmentStatus') as EmploymentStatus | null;
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  const sort = request.nextUrl.searchParams.get('sort') || 'order';
  const order = request.nextUrl.searchParams.get('order') || 'asc';

  const where: Prisma.FacultyWhereInput = { deletedAt: null };

  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { role: { contains: search, mode: 'insensitive' } },
      { subjects: { hasSome: [search] } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (subject) {
    where.subjects = { has: subject };
  }

  if (classLevel) {
    where.classLevels = { has: classLevel };
  }

  if (employmentStatus) {
    where.employmentStatus = employmentStatus;
  }

  const [faculty, total] = await Promise.all([
    db.faculty.findMany({
      where,
      include: {
        batches: { include: { batch: { select: { id: true, name: true } } } },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.faculty.count({ where }),
  ]);

  // Get all unique subjects and class levels for filters
  const allFaculty = await db.faculty.findMany({
    where: { deletedAt: null },
    select: { subjects: true, classLevels: true },
  });

  const allSubjects = [...new Set(allFaculty.flatMap(f => f.subjects))].sort();
  const allClassLevels = [...new Set(allFaculty.flatMap(f => f.classLevels))].sort();

  return NextResponse.json({
    faculty: faculty.map(f => ({
      id: f.id,
      slug: f.slug,
      displayName: f.displayName,
      fullName: f.fullName,
      title: f.title,
      role: f.role,
      shortBio: f.shortBio,
      fullBio: f.fullBio,
      qualifications: f.qualifications,
      experienceYears: f.experienceYears,
      languages: f.languages,
      specialities: f.specialities,
      achievements: f.achievements,
      subjects: f.subjects,
      classLevels: f.classLevels,
      socialLinks: f.socialLinks,
      publicFields: f.publicFields,
      contactEmail: f.contactEmail,
      contactPhone: f.contactPhone,
      internalNotes: f.internalNotes,
      status: f.status,
      featured: f.featured,
      order: f.order,
      consentAt: f.consentAt,
      consentBy: f.consentBy,
      photoAssetId: f.photoAssetId,
      photoAlt: f.photoAlt,
      photoFocalX: f.photoFocalX,
      photoFocalY: f.photoFocalY,
      employmentStatus: f.employmentStatus,
      joinedAt: f.joinedAt,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      batches: f.batches.map(b => ({ id: b.batch.id, name: b.batch.name })),
    })),
    filters: { subjects: allSubjects, classLevels: allClassLevels },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (limited(`faculty-create:${ip}`, 20)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const userId = request.headers.get('x-user-id') || undefined;
  const body = await request.json().catch(() => null);

  const result = facultySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Validation failed', issues: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = result.data;

  // Generate slug if not provided
  const slug = data.slug || data.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Check for duplicate slug
  const existingSlug = await db.faculty.findUnique({ where: { slug } });
  if (existingSlug) {
    return NextResponse.json({ error: 'A teacher with this name already exists. Please choose a different display name or provide a custom slug.' }, { status: 400 });
  }

  // Validate photo asset if provided
  if (data.photoAssetId) {
    const asset = await db.mediaAsset.findUnique({ where: { id: data.photoAssetId } });
    if (!asset) {
      return NextResponse.json({ error: 'Selected photo not found.' }, { status: 400 });
    }
    if (asset.slot !== 'FACULTY') {
      return NextResponse.json({ error: 'Photo must be a faculty portrait.' }, { status: 400 });
    }
  }

  // Validate consent for publishing
  if (data.status === 'PUBLISHED') {
    if (!data.photoAssetId && !data.consentAt) {
      return NextResponse.json({ error: 'Publishing requires a photo and consent.' }, { status: 400 });
    }
    if (!data.photoAlt) {
      return NextResponse.json({ error: 'Alt text is required for the photo when publishing.' }, { status: 400 });
    }
    if (!data.consentAt) {
      return NextResponse.json({ error: 'Consent is required before publishing.' }, { status: 400 });
    }
  }

  // Create faculty
  const faculty = await db.faculty.create({
    data: {
      slug,
      displayName: data.displayName,
      fullName: data.fullName,
      title: data.title,
      role: data.role,
      shortBio: data.shortBio,
      fullBio: data.fullBio,
      qualifications: data.qualifications,
      experienceYears: data.experienceYears,
      languages: data.languages,
      specialities: data.specialities,
      achievements: data.achievements as Prisma.InputJsonValue,
      subjects: data.subjects,
      classLevels: data.classLevels,
      socialLinks: data.socialLinks as Prisma.InputJsonValue,
      publicFields: data.publicFields as Prisma.InputJsonValue,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      internalNotes: data.internalNotes,
      status: data.status,
      featured: data.featured,
      order: data.order,
      consentAt: data.consentAt,
      consentBy: data.consentBy || userId,
      photoAssetId: data.photoAssetId,
      photoAlt: data.photoAlt,
      photoFocalX: data.photoFocalX,
      photoFocalY: data.photoFocalY,
      employmentStatus: data.employmentStatus,
      joinedAt: data.joinedAt,
      batches: data.batchIds.length > 0 ? { create: data.batchIds.map(batchId => ({ batchId })) } : undefined,
    },
    include: { batches: { include: { batch: true } } },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId,
      action: 'CREATE',
      entity: 'FACULTY',
      entityId: faculty.id,
      metadata: { displayName: faculty.displayName } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(faculty, { status: 201 });
}