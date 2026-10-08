import ExcelJS from 'exceljs';
import { parse as csvParse } from 'papaparse';
import { z } from 'zod';
import { ImportType, importSchemas, type EnquiryImport, type StudentImport, type BatchImport, type EnrollmentImport, type AttendanceImport, type FeePlanImport, type InstalmentImport, type PaymentImport, type ExpenseImport, type TestImport, type TestMarkImport, type FacultyImport, type TestimonialImport, type ResultImport, type GalleryImport, type AnnouncementImport } from './schemas';

export type { ImportType };

export const IMPORT_COLUMN_MAPPINGS: Record<ImportType, Record<string, string>> = {
  enquiries: {
    'id': 'id',
    'student name': 'studentName',
    'studentname': 'studentName',
    'parent name': 'parentName',
    'parentname': 'parentName',
    'class': 'class',
    'school': 'school',
    'phone': 'phone',
    'mobile': 'phone',
    'mobile no': 'phone',
    'phone no': 'phone',
    'email': 'email',
    'subjects': 'subjects',
    'message': 'message',
    'status': 'status',
    'notes': 'notes',
  },
  students: {
    'id': 'id',
    'first name': 'firstName',
    'firstname': 'firstName',
    'last name': 'lastName',
    'lastname': 'lastName',
    'phone': 'phone',
    'mobile': 'phone',
    'email': 'email',
    'class': 'className',
    'class name': 'className',
    'school': 'school',
    'admission date': 'admissionDate',
    'admissiondate': 'admissionDate',
    'status': 'status',
    'guardian name': 'guardianName',
    'guardianname': 'guardianName',
    'guardian phone': 'guardianPhone',
    'guardianphone': 'guardianPhone',
    'guardian email': 'guardianEmail',
    'guardianemail': 'guardianEmail',
    'guardian relationship': 'guardianRelationship',
    'relationship': 'guardianRelationship',
  },
  batches: {
    'id': 'id',
    'name': 'name',
    'class': 'className',
    'class name': 'className',
    'subjects': 'subjects',
    'teacher id': 'teacherId',
    'teacherid': 'teacherId',
    'days': 'days',
    'time': 'time',
    'capacity': 'capacity',
    'start date': 'startDate',
    'startdate': 'startDate',
    'end date': 'endDate',
    'enddate': 'endDate',
    'active': 'active',
  },
  enrollments: {
    'id': 'id',
    'student id': 'studentId',
    'studentid': 'studentId',
    'batch id': 'batchId',
    'batchid': 'batchId',
    'start date': 'startDate',
    'startdate': 'startDate',
    'end date': 'endDate',
    'enddate': 'endDate',
    'active': 'active',
  },
  attendance: {
    'id': 'id',
    'student id': 'studentId',
    'studentid': 'studentId',
    'batch id': 'batchId',
    'batchid': 'batchId',
    'date': 'date',
    'status': 'status',
    'notes': 'notes',
  },
  feePlans: {
    'id': 'id',
    'student id': 'studentId',
    'studentid': 'studentId',
    'batch id': 'batchId',
    'batchid': 'batchId',
    'total amount': 'totalAmount',
    'totalamount': 'totalAmount',
    'discount amount': 'discountAmount',
    'discountamount': 'discountAmount',
  },
  instalments: {
    'id': 'id',
    'fee plan id': 'feePlanId',
    'feeplanid': 'feePlanId',
    'due date': 'dueDate',
    'duedate': 'dueDate',
    'amount': 'amount',
    'paid amount': 'paidAmount',
    'paidamount': 'paidAmount',
  },
  payments: {
    'id': 'id',
    'instalment id': 'instalmentId',
    'instalmentid': 'instalmentId',
    'student id': 'studentId',
    'studentid': 'studentId',
    'amount': 'amount',
    'mode': 'mode',
    'date': 'date',
    'reference': 'reference',
    'received by id': 'receivedById',
    'receivedbyid': 'receivedById',
  },
  expenses: {
    'id': 'id',
    'category': 'category',
    'amount': 'amount',
    'date': 'date',
    'notes': 'notes',
    'receipt url': 'receiptUrl',
    'receipturl': 'receiptUrl',
  },
  tests: {
    'id': 'id',
    'batch id': 'batchId',
    'batchid': 'batchId',
    'name': 'name',
    'subject': 'subject',
    'date': 'date',
    'max marks': 'maxMarks',
    'maxmarks': 'maxMarks',
  },
  testMarks: {
    'id': 'id',
    'test id': 'testId',
    'testid': 'testId',
    'student id': 'studentId',
    'studentid': 'studentId',
    'marks': 'marks',
  },
  faculty: {
    'id': 'id',
    'name': 'name',
    'subject': 'subject',
    'expertise': 'expertise',
    'bio': 'bio',
    'photo url': 'photoUrl',
    'photourl': 'photoUrl',
    'alt text': 'altText',
    'alttext': 'altText',
    'order': 'order',
    'published': 'published',
  },
  testimonials: {
    'id': 'id',
    'quote': 'quote',
    'author': 'author',
    'order': 'order',
    'published': 'published',
  },
  results: {
    'id': 'id',
    'title': 'title',
    'text': 'text',
    'order': 'order',
    'published': 'published',
  },
  gallery: {
    'id': 'id',
    'image url': 'imageUrl',
    'imageurl': 'imageUrl',
    'caption': 'caption',
    'category': 'category',
    'alt text': 'altText',
    'alttext': 'altText',
    'order': 'order',
    'published': 'published',
  },
  announcements: {
    'id': 'id',
    'title': 'title',
    'body': 'body',
    'start date': 'startDate',
    'startdate': 'startDate',
    'end date': 'endDate',
    'enddate': 'endDate',
    'order': 'order',
    'published': 'published',
  },
};

export function mapColumns(headers: string[], type: ImportType): Record<string, string> {
  const mapping = IMPORT_COLUMN_MAPPINGS[type];
  const result: Record<string, string> = {};
  
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const mapped = mapping[normalized];
    if (mapped) {
      result[header] = mapped;
    }
  }
  
  return result;
}

export function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
      return `'${trimmed}`;
    }
    return trimmed;
  }
  return value;
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return digits.slice(1);
  }
  return digits;
}

export function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).replace(/[₹,\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num);
}

export function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  const str = String(value).trim().toLowerCase();
  return ['yes', 'y', '1', 'true'].includes(str);
}

export function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? undefined : date;
  }
  const str = String(value).trim();
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{2}\.\d{2}\.\d{4}$/,
  ];
  for (const fmt of formats) {
    if (fmt.test(str)) {
      const date = new Date(str.replace(/\//g, '-'));
      if (!isNaN(date.getTime())) return date;
    }
  }
  return undefined;
}

export async function parseExcelFile(buffer: ArrayBuffer | Uint8Array | Buffer, type: ImportType): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const workbook = new ExcelJS.Workbook();
  let nodeBuffer: Buffer;
  if (buffer instanceof ArrayBuffer) {
    nodeBuffer = Buffer.from(new Uint8Array(buffer));
  } else if (buffer instanceof Uint8Array) {
    nodeBuffer = Buffer.from(buffer);
  } else {
    nodeBuffer = Buffer.from(buffer as unknown as Uint8Array);
  }
  // @ts-expect-error - ExcelJS load expects Node.js Buffer but we're in Next.js environment
  await workbook.xlsx.load(nodeBuffer);
  const worksheet = workbook.worksheets[0];
  
  if (!worksheet) {
    throw new Error('No worksheet found in the Excel file');
  }
  
  const headers: string[] = [];
  const rows: Record<string, unknown>[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || `Column ${colNumber}`).trim();
      });
    } else {
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = sanitizeValue(cell.value);
        }
      });
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });
  
  return { headers, rows };
}

export async function parseCSVFile(content: string): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    csvParse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => sanitizeValue(value),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parse errors: ${results.errors.map(e => e.message).join(', ')}`));
        } else {
          resolve({
            headers: results.meta.fields || [],
            rows: results.data as Record<string, unknown>[],
          });
        }
      },
      error: (error: Error) => reject(error),
    });
  });
}

export function validateRows<T extends z.ZodTypeAny>(
  rows: Record<string, unknown>[],
  schema: T,
  columnMap: Record<string, string>
): { valid: z.infer<T>[]; errors: { row: number; errors: z.ZodIssue[]; data: Record<string, unknown> }[] } {
  const valid: z.infer<T>[] = [];
  const errors: { row: number; errors: z.ZodIssue[]; data: Record<string, unknown> }[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mappedRow: Record<string, unknown> = {};
    
    for (const [sourceKey, targetKey] of Object.entries(columnMap)) {
      if (sourceKey in row) {
        let value = row[sourceKey];
        
        if (targetKey.includes('phone') || targetKey.includes('Phone')) {
          value = normalizePhone(String(value || ''));
        } else if (targetKey.includes('amount') || targetKey.includes('Amount')) {
          value = parseAmount(value);
        } else if (targetKey === 'active' || targetKey === 'published') {
          value = parseBoolean(value);
        } else if (targetKey.includes('date') || targetKey.includes('Date')) {
          value = parseDate(value);
        }
        
        mappedRow[targetKey] = value;
      }
    }
    
    const result = schema.safeParse(mappedRow);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        row: i + 2,
        errors: result.error.issues,
        data: row,
      });
    }
  }
  
  return { valid, errors };
}

export async function generateTemplate(type: ImportType): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Brilliant Minds Tutorials';
  workbook.created = new Date();
  
  const dataSheet = workbook.addWorksheet('Data');
  const instructionsSheet = workbook.addWorksheet('Instructions');
  
  const schema = importSchemas[type];
  const shape = schema.shape;
  const headers = Object.keys(shape);
  
  dataSheet.columns = headers.map(key => ({
    header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
    key,
    width: 20,
  }));
  
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B2A5B' },
  };
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dataSheet.views = [{ state: 'frozen', ySplit: 1 }];
  
  const exampleRow: Record<string, unknown> = {};
  const dropdowns: Record<string, string[]> = {
    class: ['Class I – V', 'Class VI – VIII', 'Class IX – X', 'Class XI – XII'],
    status: ['new', 'contacted', 'enrolled', 'closed'],
    mode: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'],
    active: ['true', 'false'],
    published: ['true', 'false'],
  };
  
  for (const key of headers) {
    if (key === 'id') {
      exampleRow[key] = 'auto-generated';
    } else if (key.includes('phone') || key.includes('Phone')) {
      exampleRow[key] = '9876543210';
    } else if (key.includes('email') || key.includes('Email')) {
      exampleRow[key] = 'parent@example.com';
    } else if (key.includes('date') || key.includes('Date')) {
      exampleRow[key] = '2024-01-15';
    } else if (key.includes('amount') || key.includes('Amount')) {
      exampleRow[key] = 5000;
    } else if (dropdowns[key]) {
      exampleRow[key] = dropdowns[key][0];
    } else if (key.includes('name') || key.includes('Name')) {
      exampleRow[key] = `Example ${key}`;
    } else {
      exampleRow[key] = `Example ${key}`;
    }
  }
  
  dataSheet.addRow(exampleRow);
  
  for (const [key, values] of Object.entries(dropdowns)) {
    const colIndex = headers.indexOf(key);
    if (colIndex >= 0) {
      const colLetter = String.fromCharCode(65 + colIndex);
      for (let row = 2; row <= 1000; row++) {
        const cell = dataSheet.getCell(`${colLetter}${row}`);
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [values.join(',')],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid value',
          error: `Please select from: ${values.join(', ')}`,
        };
      }
    }
  }
  
  instructionsSheet.columns = [
    { header: 'Column', key: 'column', width: 30 },
    { header: 'Description', key: 'description', width: 60 },
    { header: 'Required', key: 'required', width: 10 },
    { header: 'Format / Example', key: 'format', width: 40 },
  ];
  
  instructionsSheet.getRow(1).font = { bold: true };
  instructionsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B2A5B' },
  };
  instructionsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  const fieldDescriptions: Record<string, { desc: string; required: boolean; format: string }> = {
    id: { desc: 'Unique identifier (leave blank for new records)', required: false, format: 'Auto-generated (CUID)' },
    studentName: { desc: 'Full name of the student', required: true, format: 'Max 80 characters' },
    parentName: { desc: 'Full name of parent/guardian', required: true, format: 'Max 80 characters' },
    class: { desc: 'Class group', required: true, format: 'Class I – V, Class VI – VIII, Class IX – X, Class XI – XII' },
    school: { desc: 'School name', required: false, format: 'Max 160 characters' },
    phone: { desc: 'Indian mobile number', required: false, format: '10 digits (e.g., 9876543210)' },
    email: { desc: 'Email address', required: false, format: 'Valid email format' },
    subjects: { desc: 'Subjects needing support', required: false, format: 'Max 200 characters' },
    message: { desc: 'Additional message', required: false, format: 'Max 1200 characters' },
    firstName: { desc: 'Student first name', required: true, format: 'Max 80 characters' },
    lastName: { desc: 'Student last name', required: false, format: 'Max 80 characters' },
    className: { desc: 'Class name', required: true, format: 'e.g., Class IX – X' },
    guardianName: { desc: 'Guardian full name', required: true, format: 'Max 100 characters' },
    guardianPhone: { desc: 'Guardian mobile number', required: true, format: '10 digits' },
    guardianEmail: { desc: 'Guardian email', required: false, format: 'Valid email format' },
    guardianRelationship: { desc: 'Relationship to student', required: false, format: 'e.g., Father, Mother' },
    name: { desc: 'Name of batch/faculty/testimonial', required: true, format: 'Max 100-120 characters' },
    batchSubjects: { desc: 'Subjects taught', required: true, format: 'Max 200 characters' },
    teacherId: { desc: 'Teacher user ID', required: false, format: 'CUID from Users table' },
    days: { desc: 'Days of week', required: false, format: 'e.g., Mon, Wed, Fri' },
    time: { desc: 'Class time', required: false, format: 'e.g., 4:00 PM' },
    capacity: { desc: 'Max students', required: false, format: 'Number 0-1000' },
    studentId: { desc: 'Student ID (CUID)', required: true, format: 'From Students table' },
    batchId: { desc: 'Batch ID (CUID)', required: true, format: 'From Batches table' },
    feePlanId: { desc: 'Fee Plan ID (CUID)', required: true, format: 'From Fee Plans table' },
    testId: { desc: 'Test ID (CUID)', required: true, format: 'From Tests table' },
    totalAmount: { desc: 'Total fee amount in INR', required: true, format: 'Positive integer' },
    discountAmount: { desc: 'Discount in INR', required: false, format: 'Non-negative integer' },
    dueDate: { desc: 'Instalment due date', required: true, format: 'YYYY-MM-DD' },
    amount: { desc: 'Amount in INR', required: true, format: 'Positive integer' },
    paidAmount: { desc: 'Amount paid in INR', required: false, format: 'Non-negative integer' },
    mode: { desc: 'Payment mode', required: false, format: 'CASH, UPI, CARD, BANK_TRANSFER, CHEQUE' },
    reference: { desc: 'Payment reference', required: false, format: 'Max 120 characters' },
    category: { desc: 'Expense category', required: true, format: 'e.g., Rent, Salaries, Utilities' },
    maxMarks: { desc: 'Maximum marks', required: true, format: 'Positive integer' },
    marks: { desc: 'Marks obtained', required: true, format: 'Integer 0-maxMarks' },
    subject: { desc: 'Subject name', required: true, format: 'Max 100 characters' },
    expertise: { desc: 'Area of expertise', required: true, format: 'Max 200 characters' },
    bio: { desc: 'Biography', required: true, format: 'Max 1000 characters' },
    photoUrl: { desc: 'Photo URL', required: false, format: 'Valid URL' },
    altText: { desc: 'Alt text for accessibility', required: false, format: 'Max 180 characters' },
    quote: { desc: 'Testimonial quote', required: true, format: 'Max 500 characters' },
    author: { desc: 'Author name', required: false, format: 'Max 100 characters' },
    title: { desc: 'Title', required: true, format: 'Max 120 characters' },
    text: { desc: 'Full text content', required: true, format: 'Max 2000 characters' },
    imageUrl: { desc: 'Image URL', required: true, format: 'Valid URL' },
    caption: { desc: 'Image caption', required: true, format: 'Max 180 characters' },
    body: { desc: 'Announcement body', required: true, format: 'Max 2000 characters' },
    startDate: { desc: 'Start date', required: true, format: 'YYYY-MM-DD' },
    endDate: { desc: 'End date', required: true, format: 'YYYY-MM-DD' },
    order: { desc: 'Display order', required: false, format: 'Integer (0+) ' },
    published: { desc: 'Published status', required: false, format: 'true/false' },
    active: { desc: 'Active status', required: false, format: 'true/false' },
    notes: { desc: 'Notes', required: false, format: 'Max 2000-300 characters' },
    status: { desc: 'Status', required: false, format: 'Depends on entity type' },
  };
  
  for (const key of headers) {
    const info = fieldDescriptions[key] || { desc: key, required: false, format: 'Free text' };
    const shapeKey = shape[key as keyof typeof shape];
    const isOptional = shapeKey && 'isOptional' in shapeKey && typeof shapeKey.isOptional === 'function' ? shapeKey.isOptional() : false;
    const required = key === 'id' ? false : !isOptional;
    instructionsSheet.addRow({
      column: key,
      description: info.desc,
      required: required ? 'Yes' : 'No',
      format: info.format,
    });
  }
  
  instructionsSheet.getColumn('format').width = 50;
  
  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function generateExportWorkbook(
  data: Record<ImportType, unknown[]>,
  options: { includeId?: boolean } = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Brilliant Minds Tutorials';
  workbook.created = new Date();
  
  for (const [type, records] of Object.entries(data)) {
    if (!records || records.length === 0) continue;
    
    const sheet = workbook.addWorksheet(type);
    const firstRecord = records[0] as Record<string, unknown>;
    const headers = Object.keys(firstRecord).filter(k => options.includeId || k !== 'id');
    
    sheet.columns = headers.map(key => ({
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      key,
      width: 20,
    }));
    
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B2A5B' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    
    for (const record of records) {
      const rec = record as Record<string, unknown>;
      const rowData: Record<string, unknown> = {};
      for (const key of headers) {
        let value = rec[key];
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0];
        }
        rowData[key] = value;
      }
      sheet.addRow(rowData);
    }
    
    for (let i = 1; i <= headers.length; i++) {
      const column = sheet.getColumn(i);
      let maxLength = column.header?.length || 10;
      column.eachCell({ includeEmpty: false }, (cell) => {
        const len = String(cell.value || '').length;
        if (len > maxLength) maxLength = len;
      });
      column.width = Math.min(maxLength + 2, 50);
    }
  }
  
  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function generateErrorReport(
  errors: { row: number; errors: z.ZodIssue[]; data: Record<string, unknown> }[],
  headers: string[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Errors');
  
  const errorHeaders = ['Row', 'Error', ...headers];
  sheet.columns = errorHeaders.map(key => ({
    header: key,
    key: key.toLowerCase().replace(' ', ''),
    width: 30,
  }));
  
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB42318' },
  };
  
  for (const error of errors) {
    const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    const rowData: Record<string, unknown> = { row: error.row, error: errorMessages };
    for (const header of headers) {
      rowData[header.toLowerCase().replace(' ', '')] = error.data[header] || '';
    }
    sheet.addRow(rowData);
  }
  
  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export function createCsvContent(rows: Record<string, unknown>[], headers: string[]): string {
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}