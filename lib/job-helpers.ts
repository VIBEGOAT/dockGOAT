/**
 * Job helper utilities for common docking job operations
 */

import connectDB from './mongodb';
import DockingJob, { JobStatus, IDockingJob, VinaGridParams } from '@/models/Job';

/**
 * Create a new docking job
 */
export async function createJob(
  userId: string,
  jobName: string,
  ligandUrl: string,
  targetUrl: string,
  vinaParams: VinaGridParams,
  webhookUrl?: string
): Promise<IDockingJob> {
  await connectDB();

  const job = await DockingJob.create({
    userId,
    jobName,
    status: JobStatus.PENDING,
    ligandUrl,
    targetUrl,
    vinaParams,
    webhookUrl,
  });

  return job;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<IDockingJob | null> {
  await connectDB();
  return await DockingJob.findById(jobId);
}

/**
 * Get all jobs for a user
 */
export async function getUserJobs(
  userId: string,
  status?: JobStatus,
  limit: number = 50,
  offset: number = 0
): Promise<{ jobs: IDockingJob[]; total: number }> {
  await connectDB();

  const query: any = { userId };
  if (status) {
    query.status = status;
  }

  const total = await DockingJob.countDocuments(query);
  const jobs = await DockingJob.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  return { jobs: jobs as IDockingJob[], total };
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  metadata?: Partial<IDockingJob>
): Promise<IDockingJob | null> {
  await connectDB();

  return await DockingJob.findByIdAndUpdate(
    jobId,
    {
      status,
      ...metadata,
    },
    { new: true }
  );
}

/**
 * Mark job as started
 */
export async function startJob(jobId: string): Promise<IDockingJob | null> {
  return await updateJobStatus(jobId, JobStatus.RUNNING, {
    startedAt: new Date(),
  });
}

/**
 * Mark job as completed with results
 */
export async function completeJob(
  jobId: string,
  dockingResultUrl: string,
  bestAffinity: number,
  affinityResults: any[]
): Promise<IDockingJob | null> {
  return await updateJobStatus(jobId, JobStatus.COMPLETED, {
    completedAt: new Date(),
    dockingResultUrl,
    bestAffinity,
    affinityResults,
  });
}

/**
 * Mark job as failed
 */
export async function failJob(
  jobId: string,
  errorMessage: string
): Promise<IDockingJob | null> {
  return await updateJobStatus(jobId, JobStatus.FAILED, {
    completedAt: new Date(),
    errorMessage,
  });
}

/**
 * Get statistics about user's jobs
 */
export async function getUserJobStats(userId: string) {
  await connectDB();

  const stats = await DockingJob.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  stats.forEach((stat: any) => {
    result[stat._id.toLowerCase() as keyof typeof result] = stat.count;
    result.total += stat.count;
  });

  return result;
}

/**
 * Delete old jobs (for cleanup)
 */
export async function deleteOldJobs(
  userId: string,
  daysOld: number = 30
): Promise<number> {
  await connectDB();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await DockingJob.deleteMany({
    userId,
    createdAt: { $lt: cutoffDate },
  });

  return result.deletedCount || 0;
}

/**
 * Validate Vina parameters
 */
export function validateVinaParams(params: VinaGridParams): string | null {
  if (params.sizeX <= 0 || params.sizeY <= 0 || params.sizeZ <= 0) {
    return 'Grid size must be positive';
  }

  if (params.exhaustiveness && params.exhaustiveness < 1) {
    return 'Exhaustiveness must be >= 1';
  }

  if (params.numModes && params.numModes < 1) {
    return 'Number of modes must be >= 1';
  }

  if (params.energyRange && params.energyRange < 0) {
    return 'Energy range must be >= 0';
  }

  return null;
}

/**
 * Format job for API response
 */
export function formatJobResponse(job: IDockingJob) {
  return {
    id: job._id,
    name: job.jobName,
    status: job.status,
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
    bestAffinity: job.bestAffinity || null,
    resultUrl: job.dockingResultUrl || null,
    error: job.errorMessage || null,
  };
}

export const JobHelpers = {
  createJob,
  getJob,
  getUserJobs,
  updateJobStatus,
  startJob,
  completeJob,
  failJob,
  getUserJobStats,
  deleteOldJobs,
  validateVinaParams,
  formatJobResponse,
};
