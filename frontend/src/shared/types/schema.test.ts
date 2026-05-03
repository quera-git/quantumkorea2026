import { describe, expect, it } from 'vitest';

import {
  BPTRecordSchema,
  JobAcceptedSchema,
  JobMetaSchema,
  OptimizeRequestSchema,
  OptimizeResultSchema,
} from './schema';

describe('BPTRecordSchema', () => {
  it('완전한 레코드를 허용한다', () => {
    const ok = BPTRecordSchema.parse({
      vessel_id: 'D-1',
      length: 140,
      eta_int: 0,
      etb_int: 0,
      etd_int: 8,
      berth_position: 100,
      yangha_van: 30,
      seonjeok_van: 30,
    });
    expect(ok.vessel_id).toBe('D-1');
  });

  it('yangha_van/seonjeok_van 누락 시 0 으로 채운다', () => {
    const ok = BPTRecordSchema.parse({
      vessel_id: 'X',
      length: 100,
      eta_int: 0,
      etb_int: 0,
      etd_int: 1,
      berth_position: 0,
    });
    expect(ok.yangha_van).toBe(0);
    expect(ok.seonjeok_van).toBe(0);
  });

  it('length 가 0 이하면 거부한다', () => {
    expect(() =>
      BPTRecordSchema.parse({
        vessel_id: 'X',
        length: 0,
        eta_int: 0,
        etb_int: 0,
        etd_int: 1,
        berth_position: 0,
      }),
    ).toThrow();
  });

  it('vessel_id 가 빈 문자열이면 거부한다', () => {
    expect(() =>
      BPTRecordSchema.parse({
        vessel_id: '',
        length: 100,
        eta_int: 0,
        etb_int: 0,
        etd_int: 1,
        berth_position: 0,
      }),
    ).toThrow();
  });
});

describe('OptimizeRequestSchema', () => {
  it('알 수 없는 solver 는 거부한다', () => {
    expect(() =>
      OptimizeRequestSchema.parse({
        bpt_records: [],
        solver: 'random' as never,
      }),
    ).toThrow();
  });

  it('planning_start_time 누락 시 0 으로 채운다', () => {
    const r = OptimizeRequestSchema.parse({
      bpt_records: [],
      solver: 'gurobi',
    });
    expect(r.planning_start_time).toBe(0);
  });
});

describe('OptimizeResultSchema', () => {
  it('schedule 누락 시 빈 배열로 채운다', () => {
    const r = OptimizeResultSchema.parse({
      job_id: 'j1',
      status: 'running',
    });
    expect(r.schedule).toEqual([]);
    expect(r.objective_value).toBeNull();
    expect(r.error_message).toBeNull();
  });

  it('알 수 없는 status 는 거부한다', () => {
    expect(() => OptimizeResultSchema.parse({ job_id: 'j1', status: 'whatever' })).toThrow();
  });
});

describe('JobAcceptedSchema', () => {
  it('status 가 빠지면 running 으로 채운다', () => {
    const j = JobAcceptedSchema.parse({ job_id: 'j1' });
    expect(j.status).toBe('running');
  });
});

describe('JobMetaSchema', () => {
  it('필수 필드(elapsed_seconds 등) 가 null 이어도 허용한다', () => {
    const m = JobMetaSchema.parse({
      job_id: 'j1',
      status: 'running',
      solver: 'gurobi',
      objective_value: null,
      elapsed_seconds: null,
      created_at: null,
      started_at: null,
      completed_at: null,
    });
    expect(m.status).toBe('running');
  });
});
