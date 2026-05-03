// status-allocation-berths/schema.py 의 도메인 유틸 TS 포팅.
// row 단위 추론(터미널/선석/중심 y), 스냅, 충돌 검사 헬퍼.

import {
  GAM_BERTHS,
  MIN_CLEARANCE_M,
  SND_BERTHS,
  TERMINAL_LAYOUT,
  TIME_GRID_MIN,
  Y_GRID_M,
  type Terminal,
} from './constants';
import type { Assignment } from './types';

/** berth 번호만으로 터미널 추론. 1~5=SND, 6~9=GAM, 그 외 빈 문자열. */
export function inferTerminalFromBerth(berth: number | null | undefined): Terminal | '' {
  if (berth == null || !Number.isFinite(berth)) return '';
  const b = Math.trunc(berth);
  if (SND_BERTHS.includes(b as (typeof SND_BERTHS)[number])) return 'SND';
  if (GAM_BERTHS.includes(b as (typeof GAM_BERTHS)[number])) return 'GAM';
  return '';
}

/** y(m) 위치 → 그 터미널의 berth 번호 추론. layout.berths 의 인덱스를 step 으로 매핑. */
export function inferBerthFromY(terminal: Terminal | '', yM: number | null): number | null {
  if (!terminal || yM == null || !Number.isFinite(yM)) return null;
  const layout = TERMINAL_LAYOUT[terminal];
  if (!layout) return null;
  const clamped = Math.min(Math.max(yM, 0), layout.yMax - 1e-6);
  let idx = Math.floor(clamped / layout.step);
  idx = Math.max(0, Math.min(idx, layout.berths.length - 1));
  return layout.berths[idx] ?? null;
}

/** 특정 berth 의 y 범위(아래끝, 위끝). 없으면 [null, null]. */
export function berthBandBounds(
  terminal: Terminal | '',
  berth: number,
): [number, number] | [null, null] {
  if (!terminal) return [null, null];
  const layout = TERMINAL_LAYOUT[terminal];
  if (!layout) return [null, null];
  const idx = layout.berths.indexOf(berth);
  if (idx < 0) return [null, null];
  return [idx * layout.step, (idx + 1) * layout.step];
}

/** f/e 가 있으면 중심값, 없으면 y_m 또는 bp. (schema.py row_center_y 동일.) */
export function rowCenterY(row: Pick<Assignment, 'f' | 'e'>): number | null {
  const f = numberOrNull(row.f);
  const e = numberOrNull(row.e);
  if (f != null && e != null) return (f + e) / 2;
  return null;
}

/** [min(f,e), max(f,e)] 또는 중심값만 있다면 [y,y]. */
export function rowSpan(row: Pick<Assignment, 'f' | 'e'>): [number, number] | [null, null] {
  const f = numberOrNull(row.f);
  const e = numberOrNull(row.e);
  if (f != null && e != null) return [Math.min(f, e), Math.max(f, e)];
  const c = rowCenterY(row);
  if (c == null) return [null, null];
  return [c, c];
}

/**
 * 두 선체 구간(a, b) 사이 m 단위 gap.
 * - 양수: 떨어진 거리
 * - 0: 접촉
 * - 음수: 겹친 길이(절댓값)
 */
export function spanGapM(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number | null {
  if (![a0, a1, b0, b1].every(Number.isFinite)) return null;
  const [aLo, aHi] = a0 <= a1 ? [a0, a1] : [a1, a0];
  const [bLo, bHi] = b0 <= b1 ? [b0, b1] : [b1, b0];
  if (aHi < bLo) return bLo - aHi;
  if (bHi < aLo) return aLo - bHi;
  return -Math.min(aHi, bHi) + Math.max(aLo, bLo);
}

/** 시간 5분 스냅 (snap_time_5min). ISO 문자열 입력/출력. */
export function snapTimeMin(iso: string | null | undefined, gridMin = TIME_GRID_MIN): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  d.setSeconds(0, 0);
  const totalMin = d.getHours() * 60 + d.getMinutes();
  const snapped = Math.round(totalMin / gridMin) * gridMin;
  const dayOffset = Math.floor(snapped / (24 * 60));
  const remaining = snapped - dayOffset * 24 * 60;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setMinutes(remaining);
  return d.toISOString();
}

/** y 30m 스냅. */
export function snapY30m(yM: number, gridM = Y_GRID_M): number {
  if (!Number.isFinite(yM)) return 0;
  return Math.round(yM / gridM) * gridM;
}

/** 시간 구간 겹침 검사 (a/b 가 닿기만 하면 false 즉 schema.py 동일). */
export function timeOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  const as = aStart ? Date.parse(aStart) : NaN;
  const ae = aEnd ? Date.parse(aEnd) : NaN;
  const bs = bStart ? Date.parse(bStart) : NaN;
  const be = bEnd ? Date.parse(bEnd) : NaN;
  if ([as, ae, bs, be].some(Number.isNaN)) return false;
  return !(ae <= bs || be <= as);
}

/**
 * 한 행이 그 터미널 layout 의 y 범위를 벗어나는지.
 * (schema.py validate_df 의 'position' 룰.)
 */
export function isOutOfLayoutBounds(
  terminal: Terminal | '',
  span: [number, number] | [null, null],
): boolean {
  if (!terminal) return false;
  const [lo, hi] = span;
  if (lo == null || hi == null) return false;
  const layout = TERMINAL_LAYOUT[terminal];
  if (!layout) return false;
  return lo < 0 || hi > layout.yMax;
}

export const CLEARANCE_M = MIN_CLEARANCE_M;

function numberOrNull(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Number.isFinite(v) ? v : null;
}
