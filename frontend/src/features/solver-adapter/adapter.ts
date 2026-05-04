// 풍부 Assignment ↔ 백엔드 BPTRecord (1D) 양방향 어댑터.
//
// 핵심 개념:
//   1) reference time:
//      Streamlit/노트북의 etb_int 는 "어떤 기준 시각으로부터 몇 시간 후" 라는 hour offset.
//      각 row 가 (start, etbInt) 둘 다 가지고 있으면 reference = start - etbInt*hour 로 역산 가능.
//      여러 row 의 reference 가 미세하게 다르면 (편집 전 데이터의 일관성 문제) 가장 빈도 높은
//      값(=mode) 을 채택해 안정적으로 작동.
//
//   2) 길이 보존:
//      BPTRecord.length = e - f. f/e 가 같으면 length=0 → backend 의 gt:0 검증 거부.
//      어댑터가 사전 차단한다.
//
//   3) berth_position:
//      backend 는 1D, "접안위치(F)" = 선체 앞단. f/e 중 작은 값을 berth_position 으로.
//
//   4) stitch:
//      solver 결과(ScheduleEntry) 는 1D (vessel_id 기반). voyage 매칭으로 풍부한 메타
//      (terminal/berth/vessel/route/...) 를 복구. berth 는 새 위치로 재추론.

import { TERMINAL_LAYOUT, inferBerthFromY, type Terminal } from '@/shared/domain';
import type { Assignment } from '@/shared/domain/types';
import type {
  BPTRecord,
  OptimizeRequest,
  ScheduleEntry,
  SolverName,
} from '@/shared/types/schema';

const HOUR_MS = 3_600_000;

/**
 * 어댑터 검증 결과. blocking 이면 제출 불가.
 * Phase 1-2 의 도메인 검증과는 별개 — 이건 "BPTRecord 변환에 필요한 최소 조건" 만 본다.
 */
export interface AdapterCheck {
  ok: boolean;
  blocking: string[];
  warnings: string[];
}

export function adapterCheck(rows: Assignment[]): AdapterCheck {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    blocking.push('편집본이 비어 있습니다.');
    return { ok: false, blocking, warnings };
  }

  for (const r of rows) {
    if (!r.voyage) {
      blocking.push(`vessel_id(=voyage) 누락: rowId=${r.rowId}`);
    }
    if (!r.start || !r.end) {
      blocking.push(`start/end 누락: ${r.voyage || r.rowId}`);
      continue;
    }
    if (Number.isNaN(Date.parse(r.start)) || Number.isNaN(Date.parse(r.end))) {
      blocking.push(`start/end 시각 파싱 실패: ${r.voyage}`);
    }
    if (r.f == null || r.e == null) {
      blocking.push(`f/e 누락: ${r.voyage}`);
      continue;
    }
    const length = Math.abs(r.e - r.f);
    if (length <= 0) {
      blocking.push(`선체 길이 0: ${r.voyage} (f=${r.f}, e=${r.e})`);
    } else if (length < 30) {
      warnings.push(`매우 짧은 선체: ${r.voyage} (${length.toFixed(1)}m)`);
    }
    if (r.terminal !== 'SND' && r.terminal !== 'GAM') {
      blocking.push(`터미널 미지정: ${r.voyage}`);
    }
  }

  return { ok: blocking.length === 0, blocking, warnings };
}

/**
 * 행들의 (start, etbInt) 쌍에서 reference time(=etbInt 0 이 가리키는 시각) 을 추론.
 * 모든 행이 동일한 reference 를 공유한다는 가정 — 데이터 노이즈가 있을 수 있어 가장 빈도
 * 높은 값을 mode 로 채택.
 */
export function deriveReferenceTime(rows: Assignment[]): Date {
  const candidates = new Map<number, number>(); // ms → count
  for (const r of rows) {
    if (!r.start) continue;
    const startMs = Date.parse(r.start);
    if (!Number.isFinite(startMs)) continue;
    const etb = r.etbInt;
    if (etb == null || !Number.isFinite(etb)) continue;
    // hour 단위로 묶어 카운팅 (1분 단위 noise 흡수).
    const refMs = Math.round((startMs - etb * HOUR_MS) / HOUR_MS) * HOUR_MS;
    candidates.set(refMs, (candidates.get(refMs) ?? 0) + 1);
  }
  if (candidates.size > 0) {
    let bestMs = 0;
    let bestCount = -1;
    for (const [ms, c] of candidates) {
      if (c > bestCount) {
        bestCount = c;
        bestMs = ms;
      }
    }
    return new Date(bestMs);
  }
  // fallback: 가장 이른 start 를 reference (=etb 0)
  let lo = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (!r.start) continue;
    const t = Date.parse(r.start);
    if (Number.isFinite(t)) lo = Math.min(lo, t);
  }
  if (Number.isFinite(lo)) return new Date(lo);
  return new Date();
}

function hoursFrom(iso: string, ref: Date): number {
  return (Date.parse(iso) - ref.getTime()) / HOUR_MS;
}
function isoFromHours(h: number, ref: Date): string {
  return new Date(ref.getTime() + h * HOUR_MS).toISOString();
}

/** 단일 Assignment 를 BPTRecord 로. 검증 통과 가정. */
export function assignmentToBPTRecord(a: Assignment, ref: Date): BPTRecord {
  if (!a.start || !a.end || a.f == null || a.e == null) {
    throw new Error(`assignmentToBPTRecord: missing fields on ${a.voyage}`);
  }
  const lengthRaw = Math.abs(a.e - a.f);
  // backend 는 length: int gt:0. 안전하게 ceil + max(1).
  const lengthInt = Math.max(1, Math.round(lengthRaw));
  const berthPos = Math.min(a.f, a.e);
  const etbInt = hoursFrom(a.start, ref);
  const etdInt = hoursFrom(a.end, ref);
  const etaInt = a.eta ? hoursFrom(a.eta, ref) : etbInt;
  return {
    vessel_id: a.voyage,
    length: lengthInt,
    eta_int: etaInt,
    etb_int: etbInt,
    etd_int: etdInt,
    berth_position: berthPos,
    yangha_van: a.yanghaVan ?? 0,
    seonjeok_van: a.seonjeokVan ?? 0,
  };
}

export interface AdaptToRequestResult {
  request: OptimizeRequest;
  reference: Date;
  /** etb_int 의 최소값 — backend planning_start_time 후보. */
  planningStartTime: number;
}

/**
 * 편집본 + solver 선택 → POST /jobs/ 에 그대로 보낼 수 있는 OptimizeRequest 까지 빌드.
 * planning_start_time 은 시나리오에 등장하는 가장 이른 etb_int 로 (음수 방지 차원).
 */
export function buildOptimizeRequest(
  rows: Assignment[],
  solver: SolverName,
): AdaptToRequestResult {
  const reference = deriveReferenceTime(rows);
  const records = rows.map((r) => assignmentToBPTRecord(r, reference));
  const minEtb = records.reduce(
    (acc, r) => Math.min(acc, r.etb_int),
    Number.POSITIVE_INFINITY,
  );
  const planningStartTime = Number.isFinite(minEtb) ? Math.floor(minEtb) : 0;
  return {
    reference,
    planningStartTime,
    request: {
      bpt_records: records,
      solver,
      planning_start_time: planningStartTime,
    },
  };
}

/**
 * 솔버 결과 (1D ScheduleEntry[]) + 원본 풍부 시나리오 → 풍부 결과 Assignment[].
 *
 * - vessel_id == voyage 기준으로 원본 메타 복구.
 * - 새 berth_position(F) + length 로 f/e 재계산.
 * - berth 는 새 mid 위치로 inferBerthFromY 로 재추론. terminal 은 원본 유지
 *   (solver 가 1D 만 알아 cross-terminal 이 의도되지 않음).
 * - 시간(etb/etd/eta hour) → reference 기준 ISO 로 복원.
 */
export function stitchResult(
  schedule: ScheduleEntry[],
  originals: Assignment[],
  reference: Date,
): { rows: Assignment[]; unmatched: string[] } {
  const byVoyage = new Map<string, Assignment>();
  for (const o of originals) byVoyage.set(o.voyage, o);

  const rows: Assignment[] = [];
  const unmatched: string[] = [];

  for (const s of schedule) {
    const orig = byVoyage.get(s.vessel_id);
    if (!orig) {
      unmatched.push(s.vessel_id);
      continue;
    }
    const newF = s.berth_position;
    const newE = s.berth_position + s.length;
    const yMid = (newF + newE) / 2;
    const terminal: Terminal | '' =
      orig.terminal === 'SND' || orig.terminal === 'GAM' ? orig.terminal : '';
    const layout = terminal ? TERMINAL_LAYOUT[terminal] : null;
    // berth: solver 가 layout 안에 두지 못하면(범위 초과) inferBerthFromY 가 null →
    // 원본 berth 유지하되 경고.
    const inferredBerth =
      terminal && layout ? (inferBerthFromY(terminal, yMid) ?? orig.berth) : orig.berth;

    rows.push({
      ...orig,
      rowId: `${orig.rowId}-result`,
      start: isoFromHours(s.etb, reference),
      end: isoFromHours(s.etd, reference),
      eta: isoFromHours(s.eta, reference),
      etbInt: s.etb,
      etdInt: s.etd,
      etaInt: s.eta,
      f: newF,
      e: newE,
      length: Math.round(s.length),
      berth: inferredBerth,
    });
  }
  return { rows, unmatched };
}
