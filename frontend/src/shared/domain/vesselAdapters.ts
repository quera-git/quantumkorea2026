// BPTRecord / ScheduleEntry → VesselHoverCard·VesselDetailDialog 가 받는 Assignment 형태로
// 변환하는 어댑터. 1D 도메인(시간이 hour offset) 을 풍부 도메인으로 표시만 하는 게 목표.
//
// 핵심 결정:
//   - reference time(=hour 0 의 ISO 시각) 을 모르면 ISO string 을 만들 수 없음.
//     그 경우 start/end/eta 를 `null` 로 두고, dialog 의 hour offset 필드(etbInt 등) 만 채움.
//     사용자에게는 "-" 로 보임 (속이지 않음).
//   - terminal/berth: berth_position(m) 으로부터 inferBerthFromY 로 역추론.
//     SND/GAM 둘 다 시도하고 안 맞으면 빈 terminal + berth 0.
//   - voyage/vessel: BPTRecord/ScheduleEntry 모두 vessel_id 만 갖고 있음 →
//     voyage = vessel = vessel_id 로 표시. (실제 모선명/모선항차 구분 없음 — 솔직히 표시)
//   - planStatus: 1D 도메인은 plan_cd 없음 → 항상 null. dialog 에서 "미지정" 표시.

import { TERMINAL_LAYOUT, type Terminal } from './constants';
import type { Assignment, PlanStatus } from './types';
import { inferBerthFromY } from './utils';

const HOUR_MS = 3_600_000;

function tryInferTerminalBerth(berthPosition: number): { terminal: Terminal | ''; berth: number } {
  for (const t of ['SND', 'GAM'] as const) {
    if (berthPosition >= 0 && berthPosition <= TERMINAL_LAYOUT[t].yMax) {
      const b = inferBerthFromY(t, berthPosition);
      if (b != null) return { terminal: t, berth: b };
    }
  }
  return { terminal: '', berth: 0 };
}

function isoFromHours(h: number, ref: Date | null): string | null {
  if (!ref || !Number.isFinite(h)) return null;
  return new Date(ref.getTime() + h * HOUR_MS).toISOString();
}

/**
 * BPTRecord → Assignment-like. ref 있으면 ISO 시간 채움, 없으면 시간 null.
 * `rowId` 는 호출자가 인덱스로 unique 보장 (`bpt-{idx}-{vessel_id}`).
 */
export function bptRecordToAssignment(
  r: {
    vessel_id: string;
    length: number;
    eta_int: number;
    etb_int: number;
    etd_int: number;
    berth_position: number;
    yangha_van?: number;
    seonjeok_van?: number;
  },
  idx: number,
  ref: Date | null = null,
): Assignment {
  const { terminal, berth } = tryInferTerminalBerth(r.berth_position);
  const f = r.berth_position;
  const e = r.berth_position + r.length;
  return {
    rowId: `bpt-${idx}-${r.vessel_id}`,
    voyage: r.vessel_id,
    vessel: r.vessel_id,
    company: '',
    sectionRaw: '',
    terminal,
    berth,
    route: '',
    start: isoFromHours(r.etb_int, ref),
    end: isoFromHours(r.etd_int, ref),
    eta: isoFromHours(r.eta_int, ref),
    etbInt: r.etb_int,
    etdInt: r.etd_int,
    etaInt: r.eta_int,
    f,
    e,
    length: r.length,
    yanghaVan: r.yangha_van ?? 0,
    seonjeokVan: r.seonjeok_van ?? 0,
    shiftingVan: 0,
    workHours: Math.max(0, r.etd_int - r.etb_int),
    planStatus: null as PlanStatus | null,
  };
}

/**
 * ScheduleEntry (solver 결과) → Assignment-like. ref 있으면 ISO 시간 채움.
 */
export function scheduleEntryToAssignment(
  s: {
    vessel_id: string;
    length: number;
    eta: number;
    etb: number;
    etd: number;
    berth_position: number;
    note?: string;
  },
  idx: number,
  ref: Date | null = null,
): Assignment {
  const { terminal, berth } = tryInferTerminalBerth(s.berth_position);
  const f = s.berth_position;
  const e = s.berth_position + s.length;
  return {
    rowId: `schedule-${idx}-${s.vessel_id}`,
    voyage: s.vessel_id,
    vessel: s.vessel_id,
    company: '',
    sectionRaw: s.note ?? '',
    terminal,
    berth,
    route: '',
    start: isoFromHours(s.etb, ref),
    end: isoFromHours(s.etd, ref),
    eta: isoFromHours(s.eta, ref),
    etbInt: s.etb,
    etdInt: s.etd,
    etaInt: s.eta,
    f,
    e,
    length: s.length,
    yanghaVan: 0,
    seonjeokVan: 0,
    shiftingVan: 0,
    workHours: Math.max(0, s.etd - s.etb),
    planStatus: null as PlanStatus | null,
  };
}
