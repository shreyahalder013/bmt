import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/csrf';
import { getJobProgress } from '@/lib/queue';
import { db } from '@/lib/db';
import { ImportJobStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  
  const { jobId } = await params;
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      sendEvent({ type: 'connected', jobId });
      
      const interval = setInterval(async () => {
        try {
          const job = await db.importJob.findUnique({ 
            where: { id: jobId },
            select: { 
              id: true, 
              status: true, 
              totalRows: true, 
              validRows: true, 
              createdRows: true, 
              updatedRows: true, 
              errorRows: true, 
              skippedRows: true,
              startedAt: true,
              completedAt: true,
              errorMessage: true,
            }
          });
          
          if (!job) {
            sendEvent({ type: 'error', message: 'Job not found' });
            clearInterval(interval);
            controller.close();
            return;
          }
          
          const queueProgress = await getJobProgress(jobId);
          
          sendEvent({
            type: 'progress',
            jobId,
            status: job.status,
            progress: queueProgress?.progress || (job.status === ImportJobStatus.PROCESSING ? 50 : job.status === ImportJobStatus.COMPLETED ? 100 : 0),
            stats: {
              total: job.totalRows,
              valid: job.validRows,
              created: job.createdRows,
              updated: job.updatedRows,
              errors: job.errorRows,
              skipped: job.skippedRows,
            },
            startedAt: job.startedAt?.toISOString(),
            completedAt: job.completedAt?.toISOString(),
            errorMessage: job.errorMessage,
          });
          
          if (job.status === ImportJobStatus.COMPLETED || job.status === ImportJobStatus.FAILED || job.status === ImportJobStatus.CANCELLED) {
            sendEvent({ type: 'complete', status: job.status });
            clearInterval(interval);
            controller.close();
          }
        } catch (err) {
          sendEvent({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
      
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}