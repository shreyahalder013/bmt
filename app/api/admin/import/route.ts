import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/csrf';
import { limited } from '@/lib/rate-limit';
import { parseExcelFile, parseCSVFile, validateRows, generateTemplate, mapColumns, ImportType, normalizePhone, parseAmount, parseBoolean, parseDate } from '@/lib/import-export/excel';
import { importSchemas } from '@/lib/import-export/schemas';
import { ImportJobStatus, ImportRowStatus, ImportMatchStrategy, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { addImportJob, addUndoJob } from '@/lib/queue';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const type = request.nextUrl.searchParams.get('type') as ImportType;
  const action = request.nextUrl.searchParams.get('action');
  
  if (!type || !importSchemas[type]) {
    return NextResponse.json({ error: 'Invalid import type' }, { status: 400 });
  }
  
  if (action === 'template') {
    try {
      const buffer = await generateTemplate(type);
      const uint8Array = new Uint8Array(buffer);
      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${type}-template.xlsx"`,
        },
      });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
    }
  }
  
  const jobs = await db.importJob.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  
  return NextResponse.json(jobs);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (limited(`import:${ip}`, 10)) return NextResponse.json({ error: 'Too many import requests. Please try again later.' }, { status: 429 });
  
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as ImportType;
  const matchStrategy = (formData.get('matchStrategy') as ImportMatchStrategy) || ImportMatchStrategy.UPSERT;
  const columnMappings = formData.get('columnMappings') ? JSON.parse(formData.get('columnMappings') as string) : null;
  
  if (!file || !type || !importSchemas[type]) {
    return NextResponse.json({ error: 'Invalid file or type' }, { status: 400 });
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File size exceeds 5 MB limit' }, { status: 400 });
  }
  
  const buffer = Buffer.from(await file.arrayBuffer());
  let headers: string[];
  let rows: Record<string, unknown>[];
  
  try {
    if (file.name.endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      const parsed = await parseCSVFile(content);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      const parsed = await parseExcelFile(buffer, type);
      headers = parsed.headers;
      rows = parsed.rows;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to parse file' }, { status: 400 });
  }
  
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Row count exceeds ${MAX_ROWS} limit` }, { status: 400 });
  }
  
  const mapping = columnMappings || mapColumns(headers, type);
  const { valid, errors } = validateRows(rows, importSchemas[type], mapping);
  
  const job = await db.importJob.create({
    data: {
      type,
      fileName: file.name,
      fileSize: file.size,
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: errors.length,
      warningRows: 0,
      skippedRows: 0,
      createdRows: 0,
      updatedRows: 0,
      matchStrategy,
      createdById: request.headers.get('x-user-id') || undefined,
      status: ImportJobStatus.PENDING,
      rows: {
        create: [
          ...valid.map((v, i) => {
            const originalRow = rows.find((r, idx) => {
              const mappedRow: Record<string, unknown> = {};
              for (const [sourceKey, targetKey] of Object.entries(mapping)) {
                const tk = targetKey as string;
                if (sourceKey in r) {
                  let value = r[sourceKey];
                  if (tk.includes('phone') || tk.includes('Phone')) {
                    value = normalizePhone(String(value || ''));
                  } else if (tk.includes('amount') || tk.includes('Amount')) {
                    value = parseAmount(value);
                  } else if (tk === 'active' || tk === 'published') {
                    value = parseBoolean(value);
                  } else if (tk.includes('date') || tk.includes('Date')) {
                    value = parseDate(value);
                  }
                  mappedRow[tk] = value;
                }
              }
              return JSON.stringify(mappedRow) === JSON.stringify(v);
            });
            return {
              rowNumber: i + 1,
              status: ImportRowStatus.VALID,
              action: 'create',
              processedData: v,
              originalData: (originalRow || {}) as Prisma.InputJsonValue,
            };
          }),
          ...errors.map((e) => ({
            rowNumber: e.row,
            status: ImportRowStatus.ERROR,
            errors: { issues: e.errors } as unknown as Prisma.InputJsonValue,
            originalData: e.data as Prisma.InputJsonValue,
          })),
        ],
      },
    },
  });
  
  return NextResponse.json({
    jobId: job.id,
    totalRows: rows.length,
    validRows: valid.length,
    errorRows: errors.length,
    errors: errors.map(e => ({
      row: e.row,
      errors: e.errors.map(err => `${err.path.join('.')}: ${err.message}`),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const body = await request.json().catch(() => null);
  const jobId = body?.jobId;
  const action = body?.action;
  const matchStrategy = body?.matchStrategy;
  const columnMappings = body?.columnMappings;
  
  if (!jobId || !action) {
    return NextResponse.json({ error: 'Missing jobId or action' }, { status: 400 });
  }
  
  const job = await db.importJob.findUnique({
    where: { id: jobId },
    include: { rows: true },
  });
  
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  
  if (action === 'confirm') {
    if (job.status !== ImportJobStatus.PENDING) {
      return NextResponse.json({ error: 'Job already processed' }, { status: 400 });
    }
    
    if (columnMappings) {
      const errorRows = job.rows.filter(r => r.status === ImportRowStatus.ERROR);
      for (const row of errorRows) {
        const originalData = row.originalData as Record<string, unknown>;
        const mappedData: Record<string, unknown> = {};
        for (const [sourceKey, targetKey] of Object.entries(columnMappings)) {
          const tk = targetKey as string;
          if (sourceKey in originalData) {
            mappedData[tk] = originalData[sourceKey];
          }
        }
        const result = importSchemas[job.type as ImportType].safeParse(mappedData);
        if (result.success) {
          await db.importRow.update({
            where: { id: row.id },
            data: { status: ImportRowStatus.VALID, processedData: result.data, action: 'create' },
          });
        }
      }
    }
    
    await addImportJob(jobId);
    
    return NextResponse.json({ ok: true, queued: true });
  }
  
  if (action === 'undo') {
    if (job.status !== ImportJobStatus.COMPLETED) {
      return NextResponse.json({ error: 'Can only undo completed imports' }, { status: 400 });
    }
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (job.completedAt && job.completedAt < sevenDaysAgo) {
      return NextResponse.json({ error: 'Undo period expired (7 days)' }, { status: 400 });
    }
    
    await addUndoJob(jobId);
    
    return NextResponse.json({ ok: true, queued: true });
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  
  await db.importJob.delete({ where: { id: jobId } });
  return NextResponse.json({ ok: true });
}