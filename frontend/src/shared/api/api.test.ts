import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';
import { completeJob } from '@/test/handlers';

import { clearBptRecords, listBptRecords, uploadBptRecords } from './bpt.api';
import { extractErrorMessage } from './client';
import { getHealth } from './health.api';
import { listJobs, submitOptimizeJob } from './jobs.api';
import { getJobResult } from './results.api';

describe('health.api', () => {
  it('GET /health 가 ok 를 반환한다', async () => {
    const res = await getHealth();
    expect(res.status).toBe('ok');
  });
});

describe('bpt.api', () => {
  it('upload → list → clear 라운드트립', async () => {
    const records = [
      {
        vessel_id: 'A',
        length: 100,
        eta_int: 0,
        etb_int: 0,
        etd_int: 5,
        berth_position: 50,
        yangha_van: 0,
        seonjeok_van: 0,
      },
    ];
    const upRes = await uploadBptRecords(records);
    expect(upRes.saved).toBe(1);

    const listed = await listBptRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.vessel_id).toBe('A');

    await clearBptRecords();
    const after = await listBptRecords();
    expect(after).toHaveLength(0);
  });

  it('스키마와 다른 응답이 오면 zod 가 던진다', async () => {
    server.use(
      http.get('http://test-backend/bpt/', () =>
        HttpResponse.json([{ vessel_id: 'X' /* length 누락 */ }]),
      ),
    );
    await expect(listBptRecords()).rejects.toThrow();
  });
});

describe('jobs.api', () => {
  it('POST /jobs/ 가 job_id 와 running 상태를 돌려준다', async () => {
    const accepted = await submitOptimizeJob({
      bpt_records: [
        {
          vessel_id: 'A',
          length: 100,
          eta_int: 0,
          etb_int: 0,
          etd_int: 5,
          berth_position: 50,
          yangha_van: 0,
          seonjeok_van: 0,
        },
      ],
      solver: 'gurobi',
      planning_start_time: 0,
    });
    expect(accepted.job_id).toBeTruthy();
    expect(accepted.status).toBe('running');
  });

  it('GET /jobs/ 는 제출된 작업을 포함한다', async () => {
    const accepted = await submitOptimizeJob({
      bpt_records: [],
      solver: 'cqm',
      planning_start_time: 0,
    });
    const list = await listJobs();
    expect(list.find((j) => j.job_id === accepted.job_id)).toBeDefined();
  });
});

describe('results.api', () => {
  it('존재하지 않는 jobId 는 404 → 의미있는 에러 메시지', async () => {
    try {
      await getJobResult('does-not-exist');
      throw new Error('should have thrown');
    } catch (e) {
      expect(extractErrorMessage(e)).toContain('does-not-exist');
    }
  });

  it('completeJob 호출 후 succeeded 결과를 반환한다', async () => {
    const accepted = await submitOptimizeJob({
      bpt_records: [],
      solver: 'gurobi',
      planning_start_time: 0,
    });
    completeJob(accepted.job_id);
    const result = await getJobResult(accepted.job_id);
    expect(result.status).toBe('succeeded');
    expect(result.schedule).toHaveLength(1);
    expect(result.objective_value).toBeCloseTo(12.34);
  });
});

describe('extractErrorMessage', () => {
  it('Error 인스턴스의 메시지를 그대로 추출한다', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('비-에러 값은 문자열화한다', () => {
    expect(extractErrorMessage('plain string')).toBe('plain string');
    expect(extractErrorMessage(42)).toBe('42');
  });
});
