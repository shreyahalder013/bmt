import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/csrf';
import { limited } from '@/lib/rate-limit';
import { generateExportWorkbook, generateErrorReport, createCsvContent, ImportType } from '@/lib/import-export/excel';

const EXPORTABLE_TYPES: ImportType[] = [
  'enquiries', 'students', 'batches', 'enrollments', 'attendance',
  'feePlans', 'instalments', 'payments', 'expenses', 'tests',
  'testMarks', 'faculty', 'testimonials', 'results', 'gallery', 'announcements'
];

const FEE_EXPENSE_TYPES: ImportType[] = ['payments', 'expenses', 'feePlans', 'instalments'];

type UserRoleType = 'OWNER' | 'STAFF' | 'TEACHER';

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const type = request.nextUrl.searchParams.get('type') || '';
  const format = request.nextUrl.searchParams.get('format') || 'xlsx';
  const all = request.nextUrl.searchParams.get('all') === 'true';
  const search = request.nextUrl.searchParams.get('search') || '';
  const status = request.nextUrl.searchParams.get('status') || '';
  const batchId = request.nextUrl.searchParams.get('batchId') || '';
  const dateFrom = request.nextUrl.searchParams.get('dateFrom') || '';
  const dateTo = request.nextUrl.searchParams.get('dateTo') || '';
  
  const userRole = (request.headers.get('x-user-role') as UserRoleType) || 'STAFF';
  const isTeacher = userRole === 'TEACHER';
  const userId = request.headers.get('x-user-id') || '';
  
  if (type === 'all' || type === 'backup') {
    if (isTeacher) {
      return NextResponse.json({ error: 'Teachers cannot download full backups' }, { status: 403 });
    }
    
    const data: Record<string, unknown[]> = {};
    
    for (const t of EXPORTABLE_TYPES) {
      if (FEE_EXPENSE_TYPES.includes(t) && isTeacher) continue;
      
      let records: unknown[] = [];
      
      switch (t) {
        case 'enquiries':
          records = await db.enquiry.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { createdAt: 'desc' },
          });
          break;
        case 'students':
          records = await db.student.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { guardians: true },
            orderBy: { createdAt: 'desc' },
          });
          break;
        case 'batches':
          records = await db.batch.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { _count: { select: { enrollments: true } } },
            orderBy: { name: 'asc' },
          });
          break;
        case 'enrollments':
          records = await db.enrollment.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { student: true, batch: true },
            orderBy: { startDate: 'desc' },
          });
          break;
        case 'attendance':
          records = await db.attendanceRecord.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { date: 'desc' },
          });
          break;
        case 'feePlans':
          records = await db.feePlan.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { student: true, installments: true },
            orderBy: { createdAt: 'desc' },
          });
          break;
        case 'instalments':
          records = await db.instalment.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { feePlan: { include: { student: true } } },
            orderBy: { dueDate: 'asc' },
          });
          break;
        case 'payments':
          records = await db.payment.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { instalment: true },
            orderBy: { date: 'desc' },
          });
          break;
        case 'expenses':
          records = await db.expense.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { date: 'desc' },
          });
          break;
        case 'tests':
          records = await db.test.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { marks: true },
            orderBy: { date: 'desc' },
          });
          break;
        case 'testMarks':
          records = await db.testMark.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            include: { test: true },
            orderBy: { testId: 'desc' },
          });
          break;
        case 'faculty':
          records = await db.faculty.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { order: 'asc' },
          });
          break;
        case 'testimonials':
          records = await db.testimonial.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { order: 'asc' },
          });
          break;
        case 'results':
          records = await db.result.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { order: 'asc' },
          });
          break;
        case 'gallery':
          records = await db.galleryItem.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { order: 'asc' },
          });
          break;
        case 'announcements':
          records = await db.announcement.findMany({
            where: buildWhereClause(t, search, status, dateFrom, dateTo, userRole, userId),
            orderBy: { order: 'asc' },
          });
          break;
      }
      
      data[t] = records;
    }
    
    if (format === 'zip') {
      return NextResponse.json({ error: 'ZIP format not yet implemented, use xlsx' }, { status: 400 });
    }
    
    const buffer = await generateExportWorkbook(data, { includeId: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const uint8Array = new Uint8Array(buffer);
    
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="brilliant-minds-backup-${timestamp}.xlsx"`,
      },
    });
  }
  
  const validType = EXPORTABLE_TYPES.includes(type as ImportType);
  if (!type || !validType) {
    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  }
  
  if (FEE_EXPENSE_TYPES.includes(type as ImportType) && isTeacher) {
    return NextResponse.json({ error: 'Teachers cannot export financial data' }, { status: 403 });
  }
  
  let records: unknown[] = [];
  
  switch (type) {
    case 'enquiries':
      records = await db.enquiry.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { createdAt: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'students':
      records = await db.student.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { guardians: true },
        orderBy: { createdAt: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'batches':
      records = await db.batch.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { _count: { select: { enrollments: true } } },
        orderBy: { name: 'asc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'enrollments':
      records = await db.enrollment.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { student: true, batch: true },
        orderBy: { startDate: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'attendance':
      records = await db.attendanceRecord.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { date: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'feePlans':
      records = await db.feePlan.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { student: true, installments: true },
        orderBy: { createdAt: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'instalments':
      records = await db.instalment.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { feePlan: { include: { student: true } } },
        orderBy: { dueDate: 'asc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'payments':
      records = await db.payment.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { instalment: true },
        orderBy: { date: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'expenses':
      records = await db.expense.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { date: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'tests':
      records = await db.test.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { marks: true },
        orderBy: { date: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'testMarks':
      records = await db.testMark.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        include: { test: true },
        orderBy: { testId: 'desc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'faculty':
      records = await db.faculty.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { order: 'asc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'testimonials':
      records = await db.testimonial.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { order: 'asc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'results':
      records = await db.result.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { order: 'asc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'gallery':
      records = await db.galleryItem.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { order: 'asc' },
        take: all ? undefined : 5000,
      });
      break;
    case 'announcements':
      records = await db.announcement.findMany({
        where: buildWhereClause(type, search, status, dateFrom, dateTo, userRole, userId),
        orderBy: { order: 'asc' },
        take: all ? undefined : 5000,
      });
      break;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `${type}-export-${timestamp}`;
  
  if (format === 'csv') {
    const headers = records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : [];
    const csv = createCsvContent(records as Record<string, unknown>[], headers);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }
  
  const data = { [type]: records } as Record<ImportType, unknown[]>;
  const buffer = await generateExportWorkbook(data, { includeId: true });
  const uint8Array = new Uint8Array(buffer);
  
  return new NextResponse(uint8Array, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  });
}

function buildWhereClause(
  type: string,
  search: string,
  status: string,
  dateFrom: string,
  dateTo: string,
  userRole: UserRoleType,
  userId: string
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  
  if (search) {
    switch (type) {
      case 'enquiries':
        where.OR = [
          { studentName: { contains: search, mode: 'insensitive' } },
          { parentName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
        break;
      case 'students':
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
        break;
      case 'batches':
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { className: { contains: search, mode: 'insensitive' } },
          { subjects: { contains: search, mode: 'insensitive' } },
        ];
        break;
    }
  }
  
  if (status) {
    if (type === 'enquiries') where.status = status;
    else if (type === 'students') where.status = status;
    else if (type === 'attendance') where.status = status;
    else if (type === 'batches') where.active = status === 'active';
  }
  
  if (dateFrom || dateTo) {
    const dateField = type === 'enquiries' ? 'createdAt' : type === 'students' ? 'admissionDate' : type === 'attendance' ? 'date' : 'createdAt';
    where[dateField] = {};
    if (dateFrom) (where[dateField] as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo) (where[dateField] as Record<string, Date>).lte = new Date(dateTo);
  }
  
  if (type === 'attendance' && userRole === 'TEACHER') {
    where.batch = { teacherId: userId };
  }
  
  if (type === 'tests' && userRole === 'TEACHER') {
    where.batchId = { in: [] };
  }
  
  return where;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (limited(`export:${ip}`, 20)) return NextResponse.json({ error: 'Too many export requests' }, { status: 429 });
  
  const body = await request.json().catch(() => null);
  const type = body?.type as ImportType;
  const format = body?.format || 'xlsx';
  const recordIds = body?.recordIds as string[];
  const errors = body?.errors;
  
  if (!type || !EXPORTABLE_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  }
  
  if (recordIds && recordIds.length > 0) {
    let records: unknown[] = [];
    
    switch (type) {
      case 'enquiries':
        records = await db.enquiry.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'students':
        records = await db.student.findMany({ where: { id: { in: recordIds } }, include: { guardians: true } });
        break;
      case 'batches':
        records = await db.batch.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'enrollments':
        records = await db.enrollment.findMany({ where: { id: { in: recordIds } }, include: { student: true, batch: true } });
        break;
      case 'attendance':
        records = await db.attendanceRecord.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'feePlans':
        records = await db.feePlan.findMany({ where: { id: { in: recordIds } }, include: { installments: true } });
        break;
      case 'instalments':
        records = await db.instalment.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'payments':
        records = await db.payment.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'expenses':
        records = await db.expense.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'tests':
        records = await db.test.findMany({ where: { id: { in: recordIds } }, include: { marks: true } });
        break;
      case 'testMarks':
        records = await db.testMark.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'faculty':
        records = await db.faculty.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'testimonials':
        records = await db.testimonial.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'results':
        records = await db.result.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'gallery':
        records = await db.galleryItem.findMany({ where: { id: { in: recordIds } } });
        break;
      case 'announcements':
        records = await db.announcement.findMany({ where: { id: { in: recordIds } } });
        break;
    }
    
    if (errors && errors.length > 0) {
      const buffer = await generateErrorReport(errors, Object.keys(records[0] as Record<string, unknown> || {}));
      const uint8Array = new Uint8Array(buffer);
      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${type}-errors.xlsx"`,
        },
      });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    
    if (format === 'csv') {
      const headers = records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : [];
      const csv = createCsvContent(records as Record<string, unknown>[], headers);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${type}-selected-${timestamp}.csv"`,
        },
      });
    }
    
    const data = { [type]: records } as Record<ImportType, unknown[]>;
  const buffer = await generateExportWorkbook(data, { includeId: true });
    const uint8Array = new Uint8Array(buffer);
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${type}-selected-${timestamp}.xlsx"`,
      },
    });
  }
  
  return NextResponse.json({ error: 'No record IDs provided' }, { status: 400 });
}