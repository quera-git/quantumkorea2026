// shared/schema.py (Pydantic) 와 동기화 필요 — 변경 시 양쪽 모두 갱신.
// 추후 openapi-typescript 로 자동 생성 도입 예정 (AGENTS.md §4.1).
//
// zod 스키마는 런타임 응답 검증용. 타입은 z.infer 로 파생한다.

import { z } from 'zod';

export const SOLVER_NAMES = ['gurobi', 'cqm', 'hybrid'] as const;
export type SolverName = (typeof SOLVER_NAMES)[number];

export const JOB_STATUSES = ['pending', 'running', 'succeeded', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const BPTRecordSchema = z.object({
  vessel_id: z.string().min(1),
  length: z.number().int().positive(),
  eta_int: z.number(),
  etb_int: z.number(),
  etd_int: z.number(),
  berth_position: z.number(),
  yangha_van: z.number().default(0),
  seonjeok_van: z.number().default(0),
});
export type BPTRecord = z.infer<typeof BPTRecordSchema>;

export const ScheduleEntrySchema = z.object({
  vessel_id: z.string(),
  length: z.number(),
  eta: z.number(),
  etb: z.number(),
  etd: z.number(),
  berth_position: z.number(),
  note: z.string().default(''),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

export const OptimizeRequestSchema = z.object({
  job_id: z.string().optional(),
  bpt_records: z.array(BPTRecordSchema),
  solver: z.enum(SOLVER_NAMES),
  planning_start_time: z.number().default(0),
});
export type OptimizeRequest = z.infer<typeof OptimizeRequestSchema>;

export const OptimizeResultSchema = z.object({
  job_id: z.string(),
  status: z.enum(JOB_STATUSES),
  schedule: z.array(ScheduleEntrySchema).default([]),
  objective_value: z.number().nullable().default(null),
  elapsed_seconds: z.number().nullable().default(null),
  started_at: z.string().nullable().default(null),
  error_message: z.string().nullable().default(null),
});
export type OptimizeResult = z.infer<typeof OptimizeResultSchema>;

export const JobAcceptedSchema = z.object({
  job_id: z.string(),
  status: z.enum(JOB_STATUSES).default('running'),
});
export type JobAccepted = z.infer<typeof JobAcceptedSchema>;

// GET /jobs/ — 백엔드가 list[dict] 로 내려주므로 손으로 정의한 메타.
export const JobMetaSchema = z.object({
  job_id: z.string(),
  status: z.enum(JOB_STATUSES),
  solver: z.enum(SOLVER_NAMES),
  objective_value: z.number().nullable(),
  elapsed_seconds: z.number().nullable(),
  created_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});
export type JobMeta = z.infer<typeof JobMetaSchema>;
