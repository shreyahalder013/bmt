import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal('')).default('');
const phoneSchema = z.string().trim().regex(/^(?:\+91|91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number.').optional().or(z.literal('')).default('');
const emailSchema = z.union([z.string().trim().email().max(160), z.literal('')]).default('');
const dateSchema = z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform(val => val ? new Date(val) : undefined);
const amountSchema = z.union([z.coerce.number().int().min(0), z.literal('')]).default(0).transform(val => val === '' ? 0 : val);
const booleanSchema = z.union([z.boolean(), z.enum(['Yes', 'No', 'Y', 'N', '1', '0', 'true', 'false']), z.literal('')]).optional().transform(val => {
  if (val === undefined || val === null || val === '') return false;
  if (typeof val === 'boolean') return val;
  return ['Yes', 'Y', '1', 'true'].includes(String(val));
});

export const classSchema = z.enum([
  'Class I – V',
  'Class VI – VIII',
  'Class IX – X',
  'Class XI – XII'
]);

export const enquiryStatusSchema = z.enum(['new', 'contacted', 'enrolled', 'closed']);
export const recordStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const attendanceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
export const paymentModeSchema = z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']);
export const chequeStatusSchema = z.enum(['PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED']);

export const enquiryImportSchema = z.object({
  id: z.string().cuid().optional(),
  studentName: text(80),
  parentName: text(80),
  class: classSchema,
  school: optionalText(160),
  phone: phoneSchema,
  email: emailSchema,
  subjects: optionalText(200),
  message: optionalText(1200),
  status: enquiryStatusSchema.optional().default('new'),
  notes: optionalText(2000),
});

export const studentImportSchema = z.object({
  id: z.string().cuid().optional(),
  firstName: text(80),
  lastName: optionalText(80),
  phone: phoneSchema,
  email: emailSchema,
  className: text(40),
  school: optionalText(160),
  admissionDate: dateSchema.optional(),
  status: recordStatusSchema.optional().default('ACTIVE'),
  guardianName: text(100),
  guardianPhone: phoneSchema,
  guardianEmail: emailSchema,
  guardianRelationship: optionalText(50).default('Parent/guardian'),
});

export const batchImportSchema = z.object({
  id: z.string().cuid().optional(),
  name: text(100),
  className: text(40),
  subjects: text(200),
  teacherId: z.string().cuid().optional(),
  days: optionalText(100).default(''),
  time: optionalText(80).default(''),
  capacity: z.coerce.number().int().min(0).max(1000).default(0),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  active: booleanSchema.default(true),
});

export const enrollmentImportSchema = z.object({
  id: z.string().cuid().optional(),
  studentId: z.string().cuid(),
  batchId: z.string().cuid(),
  startDate: dateSchema.default(() => new Date()),
  endDate: dateSchema.optional(),
  active: booleanSchema.default(true),
});

export const attendanceImportSchema = z.object({
  id: z.string().cuid().optional(),
  studentId: z.string().cuid(),
  batchId: z.string().cuid(),
  date: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform(val => new Date(val)),
  status: attendanceStatusSchema.default('PRESENT'),
  notes: optionalText(300).default(''),
});

export const feePlanImportSchema = z.object({
  id: z.string().cuid().optional(),
  studentId: z.string().cuid(),
  batchId: z.string().cuid().optional(),
  totalAmount: z.coerce.number().int().positive().max(100000000),
  discountAmount: z.coerce.number().int().min(0).max(100000000).default(0),
});

export const instalmentImportSchema = z.object({
  id: z.string().cuid().optional(),
  feePlanId: z.string().cuid(),
  dueDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform(val => new Date(val)),
  amount: z.coerce.number().int().positive().max(100000000),
  paidAmount: z.coerce.number().int().min(0).max(100000000).default(0),
});

export const paymentImportSchema = z.object({
  id: z.string().cuid().optional(),
  instalmentId: z.string().cuid().optional(),
  studentId: z.string().cuid(),
  amount: z.coerce.number().int().positive().max(100000000),
  mode: paymentModeSchema.default('CASH'),
  date: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform(val => val ? new Date(val) : new Date()),
  reference: optionalText(120).default(''),
  receivedById: z.string().cuid().optional(),
});

export const expenseImportSchema = z.object({
  id: z.string().cuid().optional(),
  category: text(80),
  amount: z.coerce.number().int().positive().max(100000000),
  date: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform(val => val ? new Date(val) : new Date()),
  notes: optionalText(500).default(''),
  receiptUrl: optionalText(500).default(''),
});

export const testImportSchema = z.object({
  id: z.string().cuid().optional(),
  batchId: z.string().cuid(),
  name: text(120),
  subject: text(100),
  date: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform(val => new Date(val)),
  maxMarks: z.coerce.number().int().positive().max(10000),
});

export const testMarkImportSchema = z.object({
  id: z.string().cuid().optional(),
  testId: z.string().cuid(),
  studentId: z.string().cuid(),
  marks: z.coerce.number().int().min(0).max(100000),
});

export const facultyImportSchema = z.object({
  id: z.string().cuid().optional(),
  displayName: text(100),
  fullName: text(100),
  title: z.enum(['MR', 'MS', 'MRS', 'DR', 'SIR', 'MADAM', 'NONE']).optional().default('NONE'),
  role: text(100),
  shortBio: optionalText(200),
  fullBio: optionalText(5000),
  qualifications: optionalText(500),
  experienceYears: z.coerce.number().int().min(0).max(100).optional(),
  languages: optionalText(200),
  specialities: optionalText(500).default('').transform(val => val ? val.split(';').map(s => s.trim()).filter(Boolean) : []),
  achievements: optionalText(2000).default('').transform(val => {
    try { return val ? JSON.parse(val) : []; } catch { return []; }
  }),
  subjects: optionalText(500).default('').transform(val => val ? val.split(';').map(s => s.trim()).filter(Boolean) : []),
  classLevels: optionalText(200).default('').transform(val => val ? val.split(';').map(s => s.trim()).filter(Boolean) : []),
  socialLinks: optionalText(500).default('').transform(val => {
    try { return val ? JSON.parse(val) : {}; } catch { return {}; }
  }),
  publicFields: optionalText(200).default('').transform(val => {
    try { return val ? JSON.parse(val) : { email: false, phone: false }; } catch { return { email: false, phone: false }; }
  }),
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  internalNotes: optionalText(2000),
  status: z.enum(['PUBLISHED', 'DRAFT', 'HIDDEN', 'PENDING_APPROVAL']).optional().default('DRAFT'),
  featured: booleanSchema.default(false),
  order: z.coerce.number().int().min(0).default(0),
  consentAt: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform(val => val ? new Date(val) : undefined),
  photoAlt: optionalText(180),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'FORMER']).optional().default('ACTIVE'),
  joinedAt: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform(val => val ? new Date(val) : undefined),
});

export const facultyExtendedImportSchema = facultyImportSchema.extend({
  photoAssetId: z.string().cuid().optional(),
  photoFocalX: z.coerce.number().min(0).max(1).optional(),
  photoFocalY: z.coerce.number().min(0).max(1).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

export const testimonialImportSchema = z.object({
  id: z.string().cuid().optional(),
  quote: text(500),
  author: optionalText(100),
  order: z.coerce.number().int().min(0).default(0),
  published: booleanSchema.default(false),
});

export const resultImportSchema = z.object({
  id: z.string().cuid().optional(),
  title: text(120),
  text: text(2000),
  order: z.coerce.number().int().min(0).default(0),
  published: booleanSchema.default(false),
});

export const galleryImportSchema = z.object({
  id: z.string().cuid().optional(),
  imageUrl: z.string().url(),
  caption: text(180),
  category: text(80),
  altText: text(180),
  order: z.coerce.number().int().min(0).default(0),
  published: booleanSchema.default(false),
});

export const announcementImportSchema = z.object({
  id: z.string().cuid().optional(),
  title: text(120),
  body: text(2000),
  startDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform(val => new Date(val)),
  endDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform(val => new Date(val)),
  order: z.coerce.number().int().min(0).default(0),
  published: booleanSchema.default(false),
});

export type EnquiryImport = z.infer<typeof enquiryImportSchema>;
export type StudentImport = z.infer<typeof studentImportSchema>;
export type BatchImport = z.infer<typeof batchImportSchema>;
export type EnrollmentImport = z.infer<typeof enrollmentImportSchema>;
export type AttendanceImport = z.infer<typeof attendanceImportSchema>;
export type FeePlanImport = z.infer<typeof feePlanImportSchema>;
export type InstalmentImport = z.infer<typeof instalmentImportSchema>;
export type PaymentImport = z.infer<typeof paymentImportSchema>;
export type ExpenseImport = z.infer<typeof expenseImportSchema>;
export type TestImport = z.infer<typeof testImportSchema>;
export type TestMarkImport = z.infer<typeof testMarkImportSchema>;
export type FacultyImport = z.infer<typeof facultyImportSchema>;
export type FacultyExtendedImport = z.infer<typeof facultyExtendedImportSchema>;
export type TestimonialImport = z.infer<typeof testimonialImportSchema>;
export type ResultImport = z.infer<typeof resultImportSchema>;
export type GalleryImport = z.infer<typeof galleryImportSchema>;
export type AnnouncementImport = z.infer<typeof announcementImportSchema>;

export const importSchemas = {
  enquiries: enquiryImportSchema,
  students: studentImportSchema,
  batches: batchImportSchema,
  enrollments: enrollmentImportSchema,
  attendance: attendanceImportSchema,
  feePlans: feePlanImportSchema,
  instalments: instalmentImportSchema,
  payments: paymentImportSchema,
  expenses: expenseImportSchema,
  tests: testImportSchema,
  testMarks: testMarkImportSchema,
  faculty: facultyImportSchema,
  testimonials: testimonialImportSchema,
  results: resultImportSchema,
  gallery: galleryImportSchema,
  announcements: announcementImportSchema,
} as const;

export type ImportType = keyof typeof importSchemas;