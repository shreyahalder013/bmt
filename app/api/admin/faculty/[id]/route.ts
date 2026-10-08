import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/csrf';
import { FacultyStatus, EmploymentStatus, FacultyTitle, Prisma } from '@prisma/client';
import { z } from 'zod';

const facultyUpdateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
  fullName: z.string().trim().min(1).max(100).optional(),
  title: z.enum(['MR', 'MS', 'MRS', 'DR', 'SIR', 'MADAM', 'NONE']).optional(),
  role: z.string().trim().min(1).max(100).optional(),
  shortBio: z.string().trim().max(200).optional().nullable(),
  fullBio: z.string().trim().max(5000).optional().nullable(),
  qualifications: z.string().trim().max(500).optional().nullable(),
  experienceYears: z.coerce.number().int().min(0).max(100).optional().nullable(),
  languages: z.string().trim().max(200).optional().nullable(),
  specialities: z.array(z.string().trim().max(100)).optional(),
  achievements: z.array(z.object({ text: z.string().trim().max(500), year: z.coerce.number().int().min(1900).max(2100).optional() })).optional(),
  subjects: z.array(z.string().trim().max(100)).optional(),
  classLevels: z.array(z.string().trim().max(50)).optional(),
  socialLinks: z.object({ linkedin: z.string().url().optional().nullable(), youtube: z.string().url().optional().nullable(), instagram: z.string().url().optional().nullable() }).optional(),
  publicFields: z.object({ email: z.boolean().default(false), phone: z.boolean().default(false) }).optional(),
  contactEmail: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  contactPhone: z.string().trim().regex(/^(?:\+91|91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number.').optional().nullable(),
  internalNotes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['PUBLISHED', 'DRAFT', 'HIDDEN', 'PENDING_APPROVAL']).optional(),
  featured: z.boolean().optional(),
  order: z.coerce.number().int().min(0).optional(),
  consentAt: z.coerce.date().optional().nullable(),
  consentBy: z.string().optional().nullable(),
  photoAssetId: z.string().cuid().optional().nullable(),
  photoAlt: z.string().trim().max(180).optional().nullable(),
  photoFocalX: z.coerce.number().min(0).max(1).optional().nullable(),
  photoFocalY: z.coerce.number().min(0).max(1).optional().nullable(),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'FORMER']).optional(),
  joinedAt: z.coerce.date().optional().nullable(),
  batchIds: z.array(z.string().cuid()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const { id } = await params;

  const faculty = await db.faculty.findUnique({
    where: { id, deletedAt: null },
    include: {
      batches: { include: { batch: { select: { id: true, name: true, className: true } } } },
    },
  });

  if (!faculty) {
    return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
  }

  return NextResponse.json({
    id: faculty.id,
    slug: faculty.slug,
    displayName: faculty.displayName,
    fullName: faculty.fullName,
    title: faculty.title,
    role: faculty.role,
    shortBio: faculty.shortBio,
    fullBio: faculty.fullBio,
    qualifications: faculty.qualifications,
    experienceYears: faculty.experienceYears,
    languages: faculty.languages,
    specialities: faculty.specialities,
    achievements: faculty.achievements,
    subjects: faculty.subjects,
    classLevels: faculty.classLevels,
    socialLinks: faculty.socialLinks,
    publicFields: faculty.publicFields,
    contactEmail: faculty.contactEmail,
    contactPhone: faculty.contactPhone,
    internalNotes: faculty.internalNotes,
    status: faculty.status,
    featured: faculty.featured,
    order: faculty.order,
    consentAt: faculty.consentAt,
    consentBy: faculty.consentBy,
    photoAssetId: faculty.photoAssetId,
    photoAlt: faculty.photoAlt,
    photoFocalX: faculty.photoFocalX,
    photoFocalY: faculty.photoFocalY,
    employmentStatus: faculty.employmentStatus,
    joinedAt: faculty.joinedAt,
    createdAt: faculty.createdAt,
    updatedAt: faculty.updatedAt,
    batches: faculty.batches.map(b => ({ id: b.batch.id, name: b.batch.name, className: b.batch.className })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const { id } = await params;
  const userId = request.headers.get('x-user-id') || undefined;
  const userRole = request.headers.get('x-user-role') || 'STAFF';

  const body = await request.json().catch(() => null);
  const result = facultyUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Validation failed', issues: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = result.data;

  const existingFaculty = await db.faculty.findUnique({ where: { id, deletedAt: null } });
  if (!existingFaculty) {
    return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
  }

  // Permission checks
  if (userRole === 'TEACHER' && existingFaculty.consentBy !== userId) {
    // Teachers can only edit their own profile
    return NextResponse.json({ error: 'You can only edit your own profile.' }, { status: 403 });
  }

  // Validate slug uniqueness if changed
  if (data.slug && data.slug !== existingFaculty.slug) {
    const slugExists = await db.faculty.findUnique({ where: { slug: data.slug } });
    if (slugExists) {
      return NextResponse.json({ error: 'This slug is already taken.' }, { status: 400 });
    }
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

  // Validate publishing requirements
  const newStatus = data.status ?? existingFaculty.status;
  const newPhotoAssetId = data.photoAssetId ?? existingFaculty.photoAssetId;
  const newPhotoAlt = data.photoAlt ?? existingFaculty.photoAlt;
  const newConsentAt = data.consentAt ?? existingFaculty.consentAt;

  if (newStatus === 'PUBLISHED') {
    if (!newPhotoAssetId && !newConsentAt) {
      return NextResponse.json({ error: 'Publishing requires a photo and consent.' }, { status: 400 });
    }
    if (!newPhotoAlt) {
      return NextResponse.json({ error: 'Alt text is required for the photo when publishing.' }, { status: 400 });
    }
    if (!newConsentAt) {
      return NextResponse.json({ error: 'Consent is required before publishing.' }, { status: 400 });
    }
  }

  // Prepare update data
  const updateData: Prisma.FacultyUpdateInput = {};

  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.shortBio !== undefined) updateData.shortBio = data.shortBio;
  if (data.fullBio !== undefined) updateData.fullBio = data.fullBio;
  if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
  if (data.experienceYears !== undefined) updateData.experienceYears = data.experienceYears;
  if (data.languages !== undefined) updateData.languages = data.languages;
  if (data.specialities !== undefined) updateData.specialities = data.specialities;
  if (data.achievements !== undefined) updateData.achievements = data.achievements as Prisma.InputJsonValue;
  if (data.subjects !== undefined) updateData.subjects = data.subjects;
  if (data.classLevels !== undefined) updateData.classLevels = data.classLevels;
  if (data.socialLinks !== undefined) updateData.socialLinks = data.socialLinks as Prisma.InputJsonValue;
  if (data.publicFields !== undefined) updateData.publicFields = data.publicFields as Prisma.InputJsonValue;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.featured !== undefined) updateData.featured = data.featured;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.consentAt !== undefined) updateData.consentAt = data.consentAt;
  if (data.consentBy !== undefined) updateData.consentBy = data.consentBy;
  if (data.photoAssetId !== undefined) updateData.photoAssetId = data.photoAssetId;
  if (data.photoAlt !== undefined) updateData.photoAlt = data.photoAlt;
  if (data.photoFocalX !== undefined) updateData.photoFocalX = data.photoFocalX;
  if (data.photoFocalY !== undefined) updateData.photoFocalY = data.photoFocalY;
  if (data.employmentStatus !== undefined) updateData.employmentStatus = data.employmentStatus;
  if (data.joinedAt !== undefined) updateData.joinedAt = data.joinedAt;

  // Handle batch updates
  if (data.batchIds !== undefined) {
    updateData.batches = {
      deleteMany: {},
      create: data.batchIds.map(batchId => ({ batchId })),
    };
  }

  const faculty = await db.faculty.update({
    where: { id },
    data: updateData,
    include: { batches: { include: { batch: true } } },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId,
      action: 'UPDATE',
      entity: 'FACULTY',
      entityId: faculty.id,
      metadata: { displayName: faculty.displayName } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    id: faculty.id,
    slug: faculty.slug,
    displayName: faculty.displayName,
    fullName: faculty.fullName,
    title: faculty.title,
    role: faculty.role,
    shortBio: faculty.shortBio,
    fullBio: faculty.fullBio,
    qualifications: faculty.qualifications,
    experienceYears: faculty.experienceYears,
    languages: faculty.languages,
    specialities: faculty.specialities,
    achievements: faculty.achievements,
    subjects: faculty.subjects,
    classLevels: faculty.classLevels,
    socialLinks: faculty.socialLinks,
    publicFields: faculty.publicFields,
    contactEmail: faculty.contactEmail,
    contactPhone: faculty.contactPhone,
    internalNotes: faculty.internalNotes,
    status: faculty.status,
    featured: faculty.featured,
    order: faculty.order,
    consentAt: faculty.consentAt,
    consentBy: faculty.consentBy,
    photoAssetId: faculty.photoAssetId,
    photoAlt: faculty.photoAlt,
    photoFocalX: faculty.photoFocalX,
    photoFocalY: faculty.photoFocalY,
    employmentStatus: faculty.employmentStatus,
    joinedAt: faculty.joinedAt,
    createdAt: faculty.createdAt,
    updatedAt: faculty.updatedAt,
    batches: faculty.batches.map(b => ({ id: b.batch.id, name: b.batch.name, className: b.batch.className })),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const { id } = await params;
  const userId = request.headers.get('x-user-id') || undefined;
  const userRole = request.headers.get('x-user-role') || 'STAFF';
  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  const existingFaculty = await db.faculty.findUnique({ where: { id, deletedAt: null } });
  if (!existingFaculty) {
    return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
  }

  // Permission checks
  if (userRole === 'STAFF' && permanent) {
    return NextResponse.json({ error: 'Only owners can permanently delete teachers.' }, { status: 403 });
  }
  if (userRole === 'TEACHER') {
    return NextResponse.json({ error: 'Teachers cannot delete profiles.' }, { status: 403 });
  }

  // Check for linked batches
  const linkedBatches = await db.facultyBatch.count({ where: { facultyId: id } });
  if (linkedBatches > 0) {
    const action = permanent ? 'delete' : 'archive';
    return NextResponse.json({
      error: `This teacher is linked to ${linkedBatches} batch(es). Please unlink them first or choose "Mark as former faculty" instead of ${action}.`,
      linkedBatches,
    }, { status: 400 });
  }

  if (permanent) {
    await db.faculty.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: 'Permanently deleted.' });
  } else {
    // Soft delete
    await db.faculty.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'HIDDEN' },
    });

    // Add to recycle bin
    await db.recycleBinItem.create({
      data: {
        entity: 'FACULTY',
        entityId: id,
        data: existingFaculty as Prisma.InputJsonValue,
        deletedById: userId,
      },
    });

    return NextResponse.json({ ok: true, message: 'Moved to recycle bin.' });
  }
}