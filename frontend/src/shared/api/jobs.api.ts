import { z } from 'zod';

import {
  JobAcceptedSchema,
  JobMetaSchema,
  type JobAccepted,
  type JobMeta,
  type OptimizeRequest,
} from '@/shared/types/schema';

import { apiClient } from './client';

export async function submitOptimizeJob(request: OptimizeRequest): Promise<JobAccepted> {
  const { data } = await apiClient.post<unknown>('/jobs/', request);
  return JobAcceptedSchema.parse(data);
}

export async function listJobs(): Promise<JobMeta[]> {
  const { data } = await apiClient.get<unknown>('/jobs/');
  return z.array(JobMetaSchema).parse(data);
}
