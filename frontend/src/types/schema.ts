// shared/schema.py (Pydantic) 와 동기화 필요 — 변경 시 양쪽 모두 갱신.
// 추후 openapi-typescript 자동 생성 도입 검토 (AGENTS.md §4.1).

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type SolverName = 'dwave' | 'gurobi';

export interface BPTRecord {
  vessel_id: string;
  arrival_time: string; // ISO8601
  berth_length: number;
  processing_time: number;
}

export interface ScheduleEntry {
  vessel_id: string;
  berth_id: string;
  start_time: string;
  end_time: string;
}

export interface OptimizeRequest {
  job_id?: string;
  bpt_records: BPTRecord[];
  solver: SolverName;
}

export interface OptimizeResult {
  job_id: string;
  status: JobStatus;
  schedule: ScheduleEntry[];
  objective_value: number | null;
  elapsed_seconds: number | null;
}
