import { PrismaClient, Prisma, ImportJobStatus, ImportRowStatus, ImportMatchStrategy, RecycleBinEntity } from '@prisma/client';
import { ImportType, importSchemas, type EnquiryImport, type StudentImport, type BatchImport, type EnrollmentImport, type AttendanceImport, type FeePlanImport, type InstalmentImport, type PaymentImport, type ExpenseImport, type TestImport, type TestMarkImport, type FacultyImport, type FacultyExtendedImport, type TestimonialImport, type ResultImport, type GalleryImport, type AnnouncementImport } from './schemas';
import { validateRows } from './excel';

const db = new PrismaClient();

interface ImportContext {
  jobId: string;
  type: ImportType;
  matchStrategy: ImportMatchStrategy;
  userId?: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; error: string; data: Record<string, unknown> }[];
}

async function findExistingEnquiry(data: EnquiryImport, matchStrategy: ImportMatchStrategy): Promise<{ id: string } | null> {
  if (data.id) {
    const existing = await db.enquiry.findUnique({ where: { id: data.id } });
    if (existing) return { id: existing.id };
  }
  if (matchStrategy !== 'CREATE_ONLY' && data.phone) {
    const existing = await db.enquiry.findFirst({ where: { phone: data.phone } });
    if (existing) return { id: existing.id };
  }
  return null;
}

async function findExistingStudent(data: StudentImport, matchStrategy: ImportMatchStrategy): Promise<{ id: string } | null> {
  if (data.id) {
    const existing = await db.student.findUnique({ where: { id: data.id } });
    if (existing) return { id: existing.id };
  }
  if (matchStrategy !== 'CREATE_ONLY' && data.phone) {
    const existing = await db.student.findFirst({ where: { phone: data.phone, deletedAt: null } });
    if (existing) return { id: existing.id };
  }
  return null;
}

async function findExistingBatch(data: BatchImport, matchStrategy: ImportMatchStrategy): Promise<{ id: string } | null> {
  if (data.id) {
    const existing = await db.batch.findUnique({ where: { id: data.id } });
    if (existing) return { id: existing.id };
  }
  if (matchStrategy !== 'CREATE_ONLY') {
    const existing = await db.batch.findFirst({ where: { name: data.name } });
    if (existing) return { id: existing.id };
  }
  return null;
}

async function processEnquiries(valid: EnquiryImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      const existing = await findExistingEnquiry(data, context.matchStrategy);
      
      if (existing) {
        if (context.matchStrategy === 'CREATE_ONLY') {
          result.skipped++;
          continue;
        }
        const previous = await db.enquiry.findUnique({ where: { id: existing.id } });
        await db.enquiry.update({
          where: { id: existing.id },
          data: {
            studentName: data.studentName,
            parentName: data.parentName,
            class: data.class,
            school: data.school,
            phone: data.phone,
            email: data.email,
            subjects: data.subjects,
            message: data.message,
            status: data.status,
            notes: data.notes,
          },
        });
        if (previous) {
          await db.importRow.updateMany({
            where: { jobId: context.jobId, entityId: existing.id },
            data: { previousValues: previous as Prisma.InputJsonValue },
          });
        }
        result.updated++;
      } else {
        await db.enquiry.create({
          data: {
            studentName: data.studentName,
            parentName: data.parentName,
            class: data.class,
            school: data.school,
            phone: data.phone,
            email: data.email,
            subjects: data.subjects,
            message: data.message,
            status: data.status,
            notes: data.notes,
          },
        });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processStudents(valid: StudentImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      const existing = await findExistingStudent(data, context.matchStrategy);
      const { guardianName, guardianPhone, guardianEmail, guardianRelationship, ...studentData } = data;
      
      if (existing) {
        if (context.matchStrategy === 'CREATE_ONLY') {
          result.skipped++;
          continue;
        }
        const previous = await db.student.findUnique({ where: { id: existing.id }, include: { guardians: true } });
        await db.student.update({
          where: { id: existing.id },
          data: {
            ...studentData,
            guardians: {
              upsert: {
                where: { id: 'first' },
                create: { name: guardianName, phone: guardianPhone, email: guardianEmail, relationship: guardianRelationship },
                update: { name: guardianName, phone: guardianPhone, email: guardianEmail, relationship: guardianRelationship },
              },
            },
          },
        });
        if (previous) {
          await db.importRow.updateMany({
            where: { jobId: context.jobId, entityId: existing.id },
            data: { previousValues: previous as Prisma.InputJsonValue },
          });
        }
        result.updated++;
      } else {
        await db.student.create({
          data: {
            ...studentData,
            guardians: {
              create: { name: guardianName, phone: guardianPhone, email: guardianEmail, relationship: guardianRelationship },
            },
          },
        });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processBatches(valid: BatchImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      const existing = await findExistingBatch(data, context.matchStrategy);
      
      if (existing) {
        if (context.matchStrategy === 'CREATE_ONLY') {
          result.skipped++;
          continue;
        }
        const previous = await db.batch.findUnique({ where: { id: existing.id } });
        await db.batch.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            className: data.className,
            subjects: data.subjects,
            teacherId: data.teacherId,
            days: data.days,
            time: data.time,
            capacity: data.capacity,
            startDate: data.startDate,
            endDate: data.endDate,
            active: data.active,
          },
        });
        if (previous) {
          await db.importRow.updateMany({
            where: { jobId: context.jobId, entityId: existing.id },
            data: { previousValues: previous as Prisma.InputJsonValue },
          });
        }
        result.updated++;
      } else {
        await db.batch.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processEnrollments(valid: EnrollmentImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      const existing = await db.enrollment.findUnique({
        where: { studentId_batchId: { studentId: data.studentId, batchId: data.batchId } },
      });
      
      if (existing) {
        if (context.matchStrategy === 'CREATE_ONLY') {
          result.skipped++;
          continue;
        }
        await db.enrollment.update({
          where: { id: existing.id },
          data: { startDate: data.startDate, endDate: data.endDate, active: data.active },
        });
        result.updated++;
      } else {
        await db.enrollment.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processAttendance(valid: AttendanceImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      const date = new Date(data.date);
      date.setHours(0, 0, 0, 0);
      
      await db.attendanceRecord.upsert({
        where: { studentId_batchId_date: { studentId: data.studentId, batchId: data.batchId, date } },
        update: { status: data.status, notes: data.notes },
        create: { ...data, date },
      });
      result.created++;
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processFeePlans(valid: FeePlanImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      const existing = await db.feePlan.findFirst({
        where: { studentId: data.studentId, batchId: data.batchId },
      });
      
      if (existing) {
        if (context.matchStrategy === 'CREATE_ONLY') {
          result.skipped++;
          continue;
        }
        await db.feePlan.update({
          where: { id: existing.id },
          data: { totalAmount: data.totalAmount, discountAmount: data.discountAmount },
        });
        result.updated++;
      } else {
        await db.feePlan.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processInstalments(valid: InstalmentImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.instalment.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          await db.instalment.update({
            where: { id: data.id },
            data: { dueDate: data.dueDate, amount: data.amount, paidAmount: data.paidAmount },
          });
          result.updated++;
        } else {
          await db.instalment.create({ data });
          result.created++;
        }
      } else {
        await db.instalment.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processPayments(valid: PaymentImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.payment.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          // Payments are typically not updated, only created
          result.skipped++;
        } else {
          await db.payment.create({ data });
          result.created++;
        }
      } else {
        await db.payment.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processExpenses(valid: ExpenseImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.expense.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          await db.expense.update({
            where: { id: data.id },
            data: { category: data.category, amount: data.amount, date: data.date, notes: data.notes, receiptUrl: data.receiptUrl },
          });
          result.updated++;
        } else {
          await db.expense.create({ data });
          result.created++;
        }
      } else {
        await db.expense.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processTests(valid: TestImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.test.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          await db.test.update({
            where: { id: data.id },
            data: { batchId: data.batchId, name: data.name, subject: data.subject, date: data.date, maxMarks: data.maxMarks },
          });
          result.updated++;
        } else {
          await db.test.create({ data });
          result.created++;
        }
      } else {
        await db.test.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processTestMarks(valid: TestMarkImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      await db.testMark.upsert({
        where: { testId_studentId: { testId: data.testId, studentId: data.studentId } },
        update: { marks: data.marks },
        create: data,
      });
      result.created++;
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processFaculty(valid: FacultyExtendedImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      // Generate slug if not provided
      const slug = data.slug || data.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      const existing = await db.faculty.findFirst({ where: { slug } });
      
      const facultyData = {
        slug,
        displayName: data.displayName,
        fullName: data.fullName,
        title: data.title,
        role: data.role,
        shortBio: data.shortBio || null,
        fullBio: data.fullBio || null,
        qualifications: data.qualifications || null,
        experienceYears: data.experienceYears || null,
        languages: data.languages || null,
        specialities: data.specialities || [],
        achievements: data.achievements ? JSON.parse(JSON.stringify(data.achievements)) : [],
        subjects: data.subjects || [],
        classLevels: data.classLevels || [],
        socialLinks: data.socialLinks ? JSON.parse(JSON.stringify(data.socialLinks)) : {},
        publicFields: data.publicFields ? JSON.parse(JSON.stringify(data.publicFields)) : { email: false, phone: false },
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        internalNotes: data.internalNotes || null,
        status: data.status,
        featured: data.featured,
        order: data.order,
        consentAt: data.consentAt,
        photoAssetId: data.photoAssetId || null,
        photoAlt: data.photoAlt || null,
        photoFocalX: data.photoFocalX ?? null,
        photoFocalY: data.photoFocalY ?? null,
        employmentStatus: data.employmentStatus,
        joinedAt: data.joinedAt,
      };
      
      if (existing) {
        if (context.matchStrategy === 'CREATE_ONLY') {
          result.skipped++;
          continue;
        }
        const previous = await db.faculty.findUnique({ where: { id: existing.id } });
        await db.faculty.update({
          where: { id: existing.id },
          data: facultyData,
        });
        if (previous) {
          await db.importRow.updateMany({
            where: { jobId: context.jobId, entityId: existing.id },
            data: { previousValues: previous as any },
          });
        }
        result.updated++;
      } else {
        await db.faculty.create({ data: facultyData });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processTestimonials(valid: TestimonialImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.testimonial.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          await db.testimonial.update({
            where: { id: data.id },
            data: { quote: data.quote, author: data.author, order: data.order, published: data.published },
          });
          result.updated++;
        } else {
          await db.testimonial.create({ data });
          result.created++;
        }
      } else {
        await db.testimonial.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processResults(valid: ResultImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.result.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          await db.result.update({
            where: { id: data.id },
            data: { title: data.title, text: data.text, order: data.order, published: data.published },
          });
          result.updated++;
        } else {
          await db.result.create({ data });
          result.created++;
        }
      } else {
        await db.result.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processGallery(valid: GalleryImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.galleryItem.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          await db.galleryItem.update({
            where: { id: data.id },
            data: { imageUrl: data.imageUrl, caption: data.caption, category: data.category, altText: data.altText, order: data.order, published: data.published },
          });
          result.updated++;
        } else {
          await db.galleryItem.create({ data });
          result.created++;
        }
      } else {
        await db.galleryItem.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

async function processAnnouncements(valid: AnnouncementImport[], context: ImportContext): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  
  for (const data of valid) {
    try {
      if (data.id) {
        const existing = await db.announcement.findUnique({ where: { id: data.id } });
        if (existing) {
          if (context.matchStrategy === 'CREATE_ONLY') {
            result.skipped++;
            continue;
          }
          await db.announcement.update({
            where: { id: data.id },
            data: { title: data.title, body: data.body, startDate: data.startDate, endDate: data.endDate, order: data.order, published: data.published },
          });
          result.updated++;
        } else {
          await db.announcement.create({ data });
          result.created++;
        }
      } else {
        await db.announcement.create({ data });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ row: 0, error: error instanceof Error ? error.message : 'Unknown error', data });
    }
  }
  
  return result;
}

const processors: Record<ImportType, (valid: unknown[], context: ImportContext) => Promise<ImportResult>> = {
  enquiries: processEnquiries as any,
  students: processStudents as any,
  batches: processBatches as any,
  enrollments: processEnrollments as any,
  attendance: processAttendance as any,
  feePlans: processFeePlans as any,
  instalments: processInstalments as any,
  payments: processPayments as any,
  expenses: processExpenses as any,
  tests: processTests as any,
  testMarks: processTestMarks as any,
  faculty: processFaculty as any,
  testimonials: processTestimonials as any,
  results: processResults as any,
  gallery: processGallery as any,
  announcements: processAnnouncements as any,
};

export async function processImportJob(jobId: string): Promise<void> {
  const job = await db.importJob.findUnique({
    where: { id: jobId },
    include: { rows: true },
  });
  
  if (!job) throw new Error('Import job not found');
  
  await db.importJob.update({
    where: { id: jobId },
    data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() },
  });
  
  const validRows = job.rows.filter(r => r.status === ImportRowStatus.VALID && r.processedData);
  const validData = validRows.map(r => r.processedData as Record<string, unknown>);
  
  const processor = processors[job.type as ImportType];
  if (!processor) throw new Error(`No processor for type: ${job.type}`);
  
  const context: ImportContext = {
    jobId,
    type: job.type as ImportType,
    matchStrategy: job.matchStrategy,
    userId: job.createdById || undefined,
  };
  
  const result = await processor(validData, context);
  
  await db.importJob.update({
    where: { id: jobId },
    data: {
      status: ImportJobStatus.COMPLETED,
      completedAt: new Date(),
      createdRows: result.created,
      updatedRows: result.updated,
      skippedRows: result.skipped,
      errorRows: result.failed,
      errorMessage: result.failed > 0 ? `Failed: ${result.failed} rows` : null,
    },
  });
}

export async function undoImportJob(jobId: string): Promise<void> {
  const job = await db.importJob.findUnique({
    where: { id: jobId },
    include: { rows: true },
  });
  
  if (!job) throw new Error('Import job not found');
  if (job.status !== ImportJobStatus.COMPLETED) throw new Error('Can only undo completed imports');
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (job.completedAt && job.completedAt < sevenDaysAgo) throw new Error('Undo period expired (7 days)');
  
  for (const row of job.rows) {
    if (row.action === 'create' && row.entityId) {
      await deleteRecord(job.type, row.entityId);
    } else if (row.action === 'update' && row.entityId && row.previousValues) {
      await restoreRecord(job.type, row.entityId, row.previousValues);
    }
  }
  
  await db.importJob.update({
    where: { id: jobId },
    data: { status: ImportJobStatus.CANCELLED },
  });
}

async function deleteRecord(type: string, entityId: string): Promise<void> {
  switch (type) {
    case 'enquiries': await db.enquiry.delete({ where: { id: entityId } }); break;
    case 'students': await db.student.update({ where: { id: entityId }, data: { deletedAt: new Date(), status: 'INACTIVE' } }); break;
    case 'batches': await db.batch.update({ where: { id: entityId }, data: { active: false } }); break;
    case 'enrollments': await db.enrollment.update({ where: { id: entityId }, data: { active: false, endDate: new Date() } }); break;
    case 'attendance': await db.attendanceRecord.delete({ where: { id: entityId } }); break;
    case 'feePlans': await db.feePlan.delete({ where: { id: entityId } }); break;
    case 'instalments': await db.instalment.delete({ where: { id: entityId } }); break;
    case 'payments': await db.payment.update({ where: { id: entityId }, data: { deletedAt: new Date() } }); break;
    case 'expenses': await db.expense.update({ where: { id: entityId }, data: { deletedAt: new Date() } }); break;
    case 'tests': await db.test.delete({ where: { id: entityId } }); break;
    case 'testMarks': await db.testMark.delete({ where: { id: entityId } }); break;
    case 'faculty': await db.faculty.delete({ where: { id: entityId } }); break;
    case 'testimonials': await db.testimonial.delete({ where: { id: entityId } }); break;
    case 'results': await db.result.delete({ where: { id: entityId } }); break;
    case 'gallery': await db.galleryItem.delete({ where: { id: entityId } }); break;
    case 'announcements': await db.announcement.delete({ where: { id: entityId } }); break;
  }
}

async function restoreRecord(type: string, entityId: string, previousValues: unknown): Promise<void> {
  const data = previousValues as Record<string, unknown>;
  switch (type) {
    case 'enquiries': await db.enquiry.update({ where: { id: entityId }, data }); break;
    case 'students': await db.student.update({ where: { id: entityId }, data }); break;
    case 'batches': await db.batch.update({ where: { id: entityId }, data }); break;
    case 'enrollments': await db.enrollment.update({ where: { id: entityId }, data }); break;
    case 'attendance': await db.attendanceRecord.update({ where: { id: entityId }, data }); break;
    case 'feePlans': await db.feePlan.update({ where: { id: entityId }, data }); break;
    case 'instalments': await db.instalment.update({ where: { id: entityId }, data }); break;
    case 'payments': await db.payment.update({ where: { id: entityId }, data }); break;
    case 'expenses': await db.expense.update({ where: { id: entityId }, data }); break;
    case 'tests': await db.test.update({ where: { id: entityId }, data }); break;
    case 'testMarks': await db.testMark.update({ where: { id: entityId }, data }); break;
    case 'faculty': await db.faculty.update({ where: { id: entityId }, data }); break;
    case 'testimonials': await db.testimonial.update({ where: { id: entityId }, data }); break;
    case 'results': await db.result.update({ where: { id: entityId }, data }); break;
    case 'gallery': await db.galleryItem.update({ where: { id: entityId }, data }); break;
    case 'announcements': await db.announcement.update({ where: { id: entityId }, data }); break;
  }
}

export async function softDeleteRecord(type: ImportType, entityId: string, userId?: string): Promise<void> {
  const entityMap: Record<ImportType, RecycleBinEntity> = {
    enquiries: RecycleBinEntity.ENQUIRY,
    students: RecycleBinEntity.STUDENT,
    batches: RecycleBinEntity.BATCH,
    enrollments: RecycleBinEntity.ENROLLMENT,
    attendance: RecycleBinEntity.ATTENDANCE_RECORD,
    feePlans: RecycleBinEntity.FEE_PLAN,
    instalments: RecycleBinEntity.INSTALMENT,
    payments: RecycleBinEntity.PAYMENT,
    expenses: RecycleBinEntity.EXPENSE,
    tests: RecycleBinEntity.TEST,
    testMarks: RecycleBinEntity.TEST_MARK,
    faculty: RecycleBinEntity.FACULTY,
    testimonials: RecycleBinEntity.TESTIMONIAL,
    results: RecycleBinEntity.RESULT,
    gallery: RecycleBinEntity.GALLERY_ITEM,
    announcements: RecycleBinEntity.ANNOUNCEMENT,
  };
  
  let data: unknown;
  switch (type) {
    case 'enquiries': data = await db.enquiry.findUnique({ where: { id: entityId } }); break;
    case 'students': data = await db.student.findUnique({ where: { id: entityId }, include: { guardians: true, enrollments: true } }); break;
    case 'batches': data = await db.batch.findUnique({ where: { id: entityId }, include: { enrollments: true } }); break;
    case 'enrollments': data = await db.enrollment.findUnique({ where: { id: entityId } }); break;
    case 'attendance': data = await db.attendanceRecord.findUnique({ where: { id: entityId } }); break;
    case 'feePlans': data = await db.feePlan.findUnique({ where: { id: entityId }, include: { installments: true } }); break;
    case 'instalments': data = await db.instalment.findUnique({ where: { id: entityId } }); break;
    case 'payments': data = await db.payment.findUnique({ where: { id: entityId } }); break;
    case 'expenses': data = await db.expense.findUnique({ where: { id: entityId } }); break;
    case 'tests': data = await db.test.findUnique({ where: { id: entityId }, include: { marks: true } }); break;
    case 'testMarks': data = await db.testMark.findUnique({ where: { id: entityId } }); break;
    case 'faculty': data = await db.faculty.findUnique({ where: { id: entityId } }); break;
    case 'testimonials': data = await db.testimonial.findUnique({ where: { id: entityId } }); break;
    case 'results': data = await db.result.findUnique({ where: { id: entityId } }); break;
    case 'gallery': data = await db.galleryItem.findUnique({ where: { id: entityId } }); break;
    case 'announcements': data = await db.announcement.findUnique({ where: { id: entityId } }); break;
  }
  
  if (!data) throw new Error('Record not found');
  
  await db.recycleBinItem.create({
    data: {
      entity: entityMap[type],
      entityId,
      data: data as Prisma.InputJsonValue,
      deletedById: userId,
    },
  });
  
  await deleteRecord(type, entityId);
}

export async function restoreFromRecycleBin(itemId: string): Promise<void> {
  const item = await db.recycleBinItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Recycle bin item not found');
  if (item.permanentlyDeletedAt) throw new Error('Item already permanently deleted');
  
  const type = item.entity.toLowerCase() as ImportType;
  const data = item.data as Record<string, unknown>;
  
  switch (type) {
    case 'enquiries': await db.enquiry.create({ data: data as any }); break;
    case 'students': {
      const { guardians, enrollments, ...studentData } = data;
      await db.student.create({ data: { ...studentData, guardians: { create: guardians as any[] } } as any });
      break;
    }
    case 'batches': await db.batch.create({ data: data as any }); break;
    case 'enrollments': await db.enrollment.create({ data: data as any }); break;
    case 'attendance': await db.attendanceRecord.create({ data: data as any }); break;
    case 'feePlans': {
      const { installments, ...feePlanData } = data;
      await db.feePlan.create({ data: { ...feePlanData, installments: { create: installments as any[] } } as any });
      break;
    }
    case 'instalments': await db.instalment.create({ data: data as any }); break;
    case 'payments': await db.payment.create({ data: data as any }); break;
    case 'expenses': await db.expense.create({ data: data as any }); break;
    case 'tests': {
      const { marks, ...testData } = data;
      await db.test.create({ data: { ...testData, marks: { create: marks as any[] } } as any });
      break;
    }
    case 'testMarks': await db.testMark.create({ data: data as any }); break;
    case 'faculty': await db.faculty.create({ data: data as any }); break;
    case 'testimonials': await db.testimonial.create({ data: data as any }); break;
    case 'results': await db.result.create({ data: data as any }); break;
    case 'gallery': await db.galleryItem.create({ data: data as any }); break;
    case 'announcements': await db.announcement.create({ data: data as any }); break;
  }
  
  await db.recycleBinItem.update({
    where: { id: itemId },
    data: { permanentlyDeletedAt: new Date() },
  });
}

export async function purgeRecycleBin(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const items = await db.recycleBinItem.findMany({
    where: { deletedAt: { lt: thirtyDaysAgo }, permanentlyDeletedAt: null },
  });
  
  for (const item of items) {
    await db.recycleBinItem.update({
      where: { id: item.id },
      data: { permanentlyDeletedAt: new Date() },
    });
  }
  
  return items.length;
}