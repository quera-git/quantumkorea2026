// shared/schema.py (Pydantic) 와 동기화 필요 — 변경 시 양쪽 모두 갱신.
// 추후 openapi-typescript 자동 생성 도입 검토 (AGENTS.md §4.1).

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type SolverName = 'gurobi' | 'cqm' | 'hybrid';

export interface BPTRecord {
  vessel_id: string;
  length: number;
  eta_int: number;
  etb_int: number;
  etd_int: number;
  berth_position: number;
  yangha_van?: number;
  seonjeok_van?: number;
}

export interface ScheduleEntry {
  vessel_id: string;
  length: number;
  eta: number;
  etb: number;
  etd: number;
  berth_position: number;
  note: string;
}

export interface OptimizeRequest {
  job_id?: string;
  bpt_records: BPTRecord[];
  solver: SolverName;
  planning_start_time?: number;
}

export interface OptimizeResult {
  job_id: string;
  status: JobStatus;
  schedule: ScheduleEntry[];
  objective_value: number | null;
  elapsed_seconds: number | null;
  started_at: string | null;
  error_message: string | null;
}

export interface JobAccepted {
  job_id: string;
  status: JobStatus;
}
