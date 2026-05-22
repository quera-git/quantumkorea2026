import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listJobs, submitOptimizeJob } from '@/shared/api/jobs.api';
import { queryKeys } from '@/shared/api/queryKeys';
import { getJobResult } from '@/shared/api/results.api';
import { env } from '@/shared/config/env';
import type { OptimizeRequest, OptimizeResult } from '@/shared/types/schema';

/** 모든 작업 메타 목록. 새 job 제출/완료 시 invalidate 된다. */
export function useJobsList() {
  return useQuery({
    queryKey: queryKeys.jobs.list,
    queryFn: listJobs,
    // 제출/완료 시 invalidate. 5s 안에 빈번한 마운트(탭 전환 등) 는 캐시.
    staleTime: 5_000,
  });
}

/** 단일 job 결과. enabled=true 일 때만 조회. */
export function useJobResult(jobId: string | null | undefined) {
  return useQuery({
    queryKey: jobId ? queryKeys.jobs.result(jobId) : ['jobs', 'result', 'none'],
    queryFn: () => getJobResult(jobId as string),
    enabled: Boolean(jobId),
    // 완료된 job 결과는 변하지 않음 — 폴링 hook 과 별개로 짧게 캐시 (탭 전환 깜빡임 방지).
    staleTime: 4_000,
  });
}

/**
 * 활성 job 폴링.
 * status 가 running/pending 일 때만 refetch 한다.
 * 완료/실패 시 jobs.list 도 함께 invalidate 해 목록 UI 를 갱신한다.
 */
export function usePollingJobResult(jobId: string | null | undefined) {
  const qc = useQueryClient();

  return useQuery({
    queryKey: jobId ? queryKeys.jobs.result(jobId) : ['jobs', 'result', 'none'],
    queryFn: async () => {
      const result = await getJobResult(jobId as string);
      if (result.status === 'succeeded' || result.status === 'failed') {
        // 목록 화면도 같이 갱신.
        qc.invalidateQueries({ queryKey: queryKeys.jobs.list });
      }
      return result;
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data as OptimizeResult | undefined;
      if (!data) return env.pollIntervalMs;
      return data.status === 'running' || data.status === 'pending' ? env.pollIntervalMs : false;
    },
    refetchIntervalInBackground: false,
  });
}

export function useSubmitJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: OptimizeRequest) => submitOptimizeJob(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.jobs.list }),
  });
}
