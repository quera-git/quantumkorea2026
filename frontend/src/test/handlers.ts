import { HttpResponse, http } from 'msw';

import type { BPTRecord, JobMeta, OptimizeRequest, OptimizeResult } from '@/shared/types/schema';

// 테스트용 in-memory backend.
// 각 테스트는 server.use(...) 로 핸들러를 오버라이드해 시나리오를 주입한다.
//
// baseURL 이 'http://test-backend' (vitest.config env) 이라 와일드카드는 단순하지만,
// dev 환경 fallback 경로(`/api/*`)도 잡히도록 두 패턴을 모두 등록한다.

interface State {
  bpt: BPTRecord[];
  jobs: Map<string, { meta: JobMeta; result: OptimizeResult | null }>;
}

const state: State = {
  bpt: [],
  jobs: new Map(),
};

export function resetMockState(): void {
  state.bpt = [];
  state.jobs.clear();
}

export function seedJob(meta: JobMeta, result: OptimizeResult | null): void {
  state.jobs.set(meta.job_id, { meta, result });
}

export function getMockState(): Readonly<State> {
  return state;
}

const BASE = 'http://test-backend';

export const handlers = [
  http.get(`${BASE}/health`, () => HttpResponse.json({ status: 'ok' })),

  http.get(`${BASE}/bpt/`, () => HttpResponse.json(state.bpt)),

  http.post(`${BASE}/bpt/`, async ({ request }) => {
    const body = (await request.json()) as BPTRecord[];
    state.bpt.push(...body);
    return HttpResponse.json({ saved: body.length }, { status: 201 });
  }),

  http.delete(`${BASE}/bpt/`, () => {
    state.bpt = [];
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/jobs/`, async ({ request }) => {
    const body = (await request.json()) as OptimizeRequest;
    const jobId = body.job_id || `job-${state.jobs.size + 1}`;
    const now = new Date().toISOString();
    const meta: JobMeta = {
      job_id: jobId,
      status: 'running',
      solver: body.solver,
      objective_value: null,
      elapsed_seconds: null,
      created_at: now,
      started_at: now,
      completed_at: null,
    };
    state.jobs.set(jobId, {
      meta,
      result: {
        job_id: jobId,
        status: 'running',
        schedule: [],
        objective_value: null,
        elapsed_seconds: null,
        started_at: now,
        error_message: null,
      },
    });
    return HttpResponse.json({ job_id: jobId, status: 'running' }, { status: 202 });
  }),

  http.get(`${BASE}/jobs/`, () => {
    return HttpResponse.json(Array.from(state.jobs.values()).map((v) => v.meta));
  }),

  http.get(`${BASE}/results/:jobId`, ({ params }) => {
    const jobId = params.jobId as string;
    const entry = state.jobs.get(jobId);
    if (!entry) {
      return HttpResponse.json({ detail: `job_id 없음: ${jobId}` }, { status: 404 });
    }
    return HttpResponse.json(entry.result);
  }),
];

/**
 * 특정 job 의 result 를 succeeded 로 갱신해 polling 종료를 시뮬레이션한다.
 */
export function completeJob(jobId: string, override: Partial<OptimizeResult> = {}): void {
  const entry = state.jobs.get(jobId);
  if (!entry) throw new Error(`unknown jobId: ${jobId}`);
  const completedAt = new Date().toISOString();
  entry.meta = {
    ...entry.meta,
    status: 'succeeded',
    objective_value: 12.34,
    elapsed_seconds: 1.5,
    completed_at: completedAt,
    ...{},
  };
  entry.result = {
    job_id: jobId,
    status: 'succeeded',
    schedule: [
      {
        vessel_id: 'D-1',
        length: 140,
        eta: 0,
        etb: 0,
        etd: 8,
        berth_position: 100,
        note: '',
      },
    ],
    objective_value: 12.34,
    elapsed_seconds: 1.5,
    started_at: entry.result?.started_at ?? null,
    error_message: null,
    ...override,
  };
}
