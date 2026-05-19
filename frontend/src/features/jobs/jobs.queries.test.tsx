import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { submitOptimizeJob } from '@/shared/api/jobs.api';
import { completeJob } from '@/test/handlers';
import { TestProviders, makeTestQueryClient } from '@/test/renderWithProviders';

import { usePollingJobResult } from './jobs.queries';

describe('usePollingJobResult', () => {
  it('running 동안 폴링하다 succeeded 가 되면 멈춘다', async () => {
    const accepted = await submitOptimizeJob({
      bpt_records: [],
      solver: 'gurobi',
      planning_start_time: 0,
    });

    const qc = makeTestQueryClient();

    const { result } = renderHook(() => usePollingJobResult(accepted.job_id), {
      wrapper: ({ children }) => <TestProviders queryClient={qc}>{children}</TestProviders>,
    });

    await waitFor(() => expect(result.current.data?.status).toBe('running'));

    // 백엔드측 상태를 succeeded 로 전환.
    completeJob(accepted.job_id);

    // 다음 폴링 사이클(50ms)에서 succeeded 가 잡혀야 한다.
    await waitFor(() => expect(result.current.data?.status).toBe('succeeded'), {
      timeout: 2000,
    });

    expect(result.current.data?.schedule).toHaveLength(1);
    expect(result.current.data?.objective_value).toBeCloseTo(12.34);

    // succeeded 이후에는 refetchInterval 이 false 가 되어 추가 요청이 발생하지 않는다.
    const dataFetchCount = result.current.dataUpdatedAt;
    await new Promise((r) => setTimeout(r, 200));
    expect(result.current.dataUpdatedAt).toBe(dataFetchCount);
  });

  it('jobId 가 null 이면 enabled=false → 호출하지 않는다', () => {
    const { result } = renderHook(() => usePollingJobResult(null), {
      wrapper: ({ children }) => <TestProviders>{children}</TestProviders>,
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
