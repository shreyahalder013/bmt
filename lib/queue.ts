import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '@/lib/db';
import { ImportJobStatus, ImportRowStatus, ImportMatchStrategy } from '@prisma/client';
import { processImportJob, undoImportJob } from '@/lib/import-export/processor';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export const importJobQueue = new Queue('import-job', { connection });

importJobQueue.on('error', (err) => {
  console.error('Import queue error:', err);
});

export async function addImportJob(jobId: string) {
  return importJobQueue.add('process', { jobId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function addUndoJob(jobId: string) {
  return importJobQueue.add('undo', { jobId }, {
    attempts: 1,
    removeOnComplete: 50,
    removeOnFail: 25,
  });
}

const processor = async (job: Job) => {
  const { jobId, type } = job.data;
  
  await job.updateProgress(5);
  
  if (type === 'undo') {
    await undoImportJob(jobId);
    await job.updateProgress(100);
    return { success: true };
  }
  
  await job.updateProgress(10);
  
  const importJob = await db.importJob.findUnique({ where: { id: jobId } });
  if (!importJob) throw new Error('Import job not found');
  
  await db.importJob.update({
    where: { id: jobId },
    data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() },
  });
  
  await job.updateProgress(20);
  
  await processImportJob(jobId);
  
  await job.updateProgress(90);
  
  const completed = await db.importJob.findUnique({ where: { id: jobId } });
  
  await job.updateProgress(100);
  
  return { 
    success: completed?.status === ImportJobStatus.COMPLETED,
    created: completed?.createdRows || 0,
    updated: completed?.updatedRows || 0,
    errors: completed?.errorRows || 0,
  };
};

export const importWorker = new Worker('import-job', processor, { 
  connection,
  concurrency: 2,
});

importWorker.on('completed', (job) => {
  console.log(`Import job ${job.id} completed:`, job.returnvalue);
});

importWorker.on('failed', (job, err) => {
  console.error(`Import job ${job?.id} failed:`, err);
});

importWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

export async function getJobProgress(jobId: string) {
  const job = await importJobQueue.getJob(jobId);
  if (!job) return null;
  
  const progress = job.progress;
  const state = await job.getState();
  
  return {
    id: job.id,
    progress: typeof progress === 'number' ? progress : 0,
    state,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}