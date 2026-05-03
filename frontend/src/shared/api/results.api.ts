import { OptimizeResultSchema, type OptimizeResult } from '@/shared/types/schema';

import { apiClient } from './client';

export async function getJobResult(jobId: string): Promise<OptimizeResult> {
  const { data } = await apiClient.get<unknown>(`/results/${jobId}`);
  return OptimizeResultSchema.parse(data);
}
