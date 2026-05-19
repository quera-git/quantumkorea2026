// 편집본 vs 원본 diff 계산.
// rowId 기준으로 매칭 → 변경된 필드만 ChangedField 로 추출.

import type { Assignment } from '@/shared/domain/types';

export type AuditField =
  | 'terminal'
  | 'berth'
  | 'start'
  | 'end'
  | 'f'
  | 'e'
  | 'y_m';

export interface ChangedField {
  field: AuditField;
  before: string | number | null;
  after: string | number | null;
  /** 시간/위치 변화량 (필요한 필드만 채워짐). */
  delta?: number;
}

export interface RowDiff {
  rowId: string;
  voyage: string;
  vessel: string;
  /** 변경 후 기준 표시 정보 (라벨용). */
  terminal: Assignment['terminal'];
  berth: number;
  changedFields: ChangedField[];
  /** 시간 변화량 (분). 0 이면 시간 변경 없음. */
  deltaMinutes: number;
  /** y(중심) 변화량 (m). 0 이면 위치 변경 없음. */
  deltaY: number;
}

export interface AuditSummary {
  /** 원본 대비 변경된 행 개수. */
  changedRowCount: number;
  /** 변경된 행들의 |Δmin| 합 (분). */
  totalMinutesMoved: number;
  /** 변경된 행들의 |Δy| 합 (m). */
  totalMetersMoved: number;
  /** 필드별 변경 횟수. */
  byField: Record<AuditField, number>;
}

/** 두 row 의 변경된 필드만 뽑는다. 변경 없으면 빈 배열. */
function diffOne(before: Assignment, after: Assignment): ChangedField[] {
  const out: ChangedField[] = [];
  if (before.terminal !== after.terminal) {
    out.push({ field: 'terminal', before: before.terminal, after: after.terminal });
  }
  if (before.berth !== after.berth) {
    out.push({ field: 'berth', before: before.berth, after: after.berth });
  }
  if (before.start !== after.start) {
    const delta = before.start && after.start
      ? Math.round((Date.parse(after.start) - Date.parse(before.start)) / 60_000)
      : 0;
    out.push({ field: 'start', before: before.start, after: after.start, delta });
  }
  if (before.end !== after.end) {
    const delta = before.end && after.end
      ? Math.round((Date.parse(after.end) - Date.parse(before.end)) / 60_000)
      : 0;
    out.push({ field: 'end', before: before.end, after: after.end, delta });
  }
  if (before.f !== after.f) {
    const delta = before.f != null && after.f != null ? after.f - before.f : 0;
    out.push({ field: 'f', before: before.f, after: after.f, delta });
  }
  if (before.e !== after.e) {
    const delta = before.e != null && after.e != null ? after.e - before.e : 0;
    out.push({ field: 'e', before: before.e, after: after.e, delta });
  }
  return out;
}

/** rowId 기준 매칭 후 변경된 행만 RowDiff[] 로 반환. */
export function diffRows(original: Assignment[], edited: Assignment[]): RowDiff[] {
  const origIndex = new Map<string, Assignment>();
  for (const r of original) origIndex.set(r.rowId, r);

  const out: RowDiff[] = [];
  for (const after of edited) {
    const before = origIndex.get(after.rowId);
    if (!before) continue;
    const changed = diffOne(before, after);
    if (changed.length === 0) continue;

    const deltaMinutes =
      before.start && after.start
        ? Math.round((Date.parse(after.start) - Date.parse(before.start)) / 60_000)
        : 0;
    const oldMid =
      before.f != null && before.e != null ? (before.f + before.e) / 2 : null;
    const newMid =
      after.f != null && after.e != null ? (after.f + after.e) / 2 : null;
    const deltaY = oldMid != null && newMid != null ? newMid - oldMid : 0;

    out.push({
      rowId: after.rowId,
      voyage: after.voyage,
      vessel: after.vessel ?? '',
      terminal: after.terminal,
      berth: after.berth,
      changedFields: changed,
      deltaMinutes,
      deltaY,
    });
  }
  return out;
}

export function summarize(diffs: RowDiff[]): AuditSummary {
  const byField: Record<AuditField, number> = {
    terminal: 0,
    berth: 0,
    start: 0,
    end: 0,
    f: 0,
    e: 0,
    y_m: 0,
  };
  let totalMinutesMoved = 0;
  let totalMetersMoved = 0;
  for (const d of diffs) {
    for (const c of d.changedFields) {
      byField[c.field] += 1;
    }
    totalMinutesMoved += Math.abs(d.deltaMinutes);
    totalMetersMoved += Math.abs(d.deltaY);
  }
  return {
    changedRowCount: diffs.length,
    totalMinutesMoved,
    totalMetersMoved,
    byField,
  };
}

/** RowDiff[] 를 한 줄당 한 행으로 펼친 CSV 문자열 생성. */
export function diffsToCsv(diffs: RowDiff[]): string {
  const headers = [
    'rowId',
    'voyage',
    'vessel',
    'terminal',
    'berth',
    'field',
    'before',
    'after',
    'delta',
    'deltaMinutes',
    'deltaY',
  ];
  const lines: string[] = [headers.join(',')];
  for (const d of diffs) {
    for (const c of d.changedFields) {
      lines.push(
        [
          csvCell(d.rowId),
          csvCell(d.voyage),
          csvCell(d.vessel),
          csvCell(d.terminal),
          d.berth,
          c.field,
          csvCell(c.before),
          csvCell(c.after),
          c.delta ?? '',
          d.deltaMinutes,
          d.deltaY,
        ].join(','),
      );
    }
  }
  return lines.join('\n');
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
