// status-allocation-berths/schema.py 의 validate_df 로직을 TS 로 1:1 포팅.
// 메시지 문구도 가능한 한 동일하게 유지 (사용자가 기존 화면 익숙해진 문구).

import {
  CLEARANCE_M,
  TERMINAL_LAYOUT,
  inferBerthFromY,
  isOutOfLayoutBounds,
  rowCenterY,
  rowSpan,
  spanGapM,
  timeOverlap,
} from '@/shared/domain';
import { GAM_BERTHS, SND_BERTHS } from '@/shared/domain/constants';
import type { Assignment } from '@/shared/domain/types';

export type ValidationField =
  | 'terminal'
  | 'berth'
  | 'time'
  | 'position'
  | 'clearance';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** 행 단위 문제는 rowId, 그룹 단위 문제(clearance) 는 'SND-3' 같은 키. */
  target: string;
  /** 그룹 키일 경우 관련 rowId 들. */
  rowIds: string[];
  field: ValidationField;
  severity: ValidationSeverity;
  message: string;
}

/** schema.py validate_df 의 TS 포팅. */
export function validateAssignments(rows: Assignment[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const r of rows) {
    const t = r.terminal;
    const b = Math.trunc(r.berth);
    const layout = t === 'SND' || t === 'GAM' ? TERMINAL_LAYOUT[t] : null;
    const span = rowSpan(r);
    const mid = rowCenterY(r);

    if (t !== 'SND' && t !== 'GAM') {
      issues.push(rowIssue(r, 'terminal', '터미널 값 오류(SND/GAM)'));
    }
    if (t === 'SND' && !SND_BERTHS.includes(b as (typeof SND_BERTHS)[number])) {
      issues.push(rowIssue(r, 'berth', '신선대 선석 범위(1~5) 위반'));
    }
    if (t === 'GAM' && !GAM_BERTHS.includes(b as (typeof GAM_BERTHS)[number])) {
      issues.push(rowIssue(r, 'berth', '감만 선석 범위(6~9) 위반'));
    }

    const startMs = r.start ? Date.parse(r.start) : NaN;
    const endMs = r.end ? Date.parse(r.end) : NaN;
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
      issues.push(rowIssue(r, 'time', '시작/종료 시간 오류'));
    }

    if (layout && isOutOfLayoutBounds(t as 'SND' | 'GAM', span)) {
      issues.push(
        rowIssue(
          r,
          'position',
          `선체 위치가 터미널 범위(0~${layout.yMax}m)를 벗어남`,
        ),
      );
    }

    if (layout && mid != null && b > 0) {
      const inferred = inferBerthFromY(t as 'SND' | 'GAM', mid);
      if (inferred != null && inferred !== b) {
        issues.push(
          rowIssue(
            r,
            'berth',
            `현재 위치(y=${mid.toFixed(1)}m) 기준 선석은 ${inferred}인데 데이터는 ${b}로 저장됨`,
            'warning',
          ),
        );
      }
    }
  }

  // clearance: 같은 (terminal, berth) 그룹 안에서 시간 겹침 + 선체구간 gap < 30m.
  const groups = groupBy(rows, (r) => `${r.terminal}-${r.berth}`);
  for (const [key, group] of groups) {
    if (!key.startsWith('SND-') && !key.startsWith('GAM-')) continue;
    const sorted = [...group].sort((a, b) => parseStart(a) - parseStart(b));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i]!;
        const c = sorted[j]!;
        if (!timeOverlap(a.start, a.end, c.start, c.end)) continue;
        const [a0, a1] = rowSpan(a);
        const [b0, b1] = rowSpan(c);
        if (a0 == null || a1 == null || b0 == null || b1 == null) continue;
        const gap = spanGapM(a0, a1, b0, b1);
        if (gap == null) continue;
        if (gap < CLEARANCE_M) {
          const message =
            gap < 0
              ? `동시간대 선체 구간이 겹침 (겹침 ${Math.abs(gap).toFixed(1)}m)`
              : `동시간대 선박 간 최소 이격 ${CLEARANCE_M}m 위반 (실제 ${gap.toFixed(1)}m)`;
          issues.push({
            target: key,
            rowIds: [a.rowId, c.rowId],
            field: 'clearance',
            severity: 'error',
            message,
          });
        }
      }
    }
  }

  return issues;
}

function rowIssue(
  r: Assignment,
  field: ValidationField,
  message: string,
  severity: ValidationSeverity = 'error',
): ValidationIssue {
  return {
    target: r.rowId,
    rowIds: [r.rowId],
    field,
    severity,
    message,
  };
}

function parseStart(r: Assignment): number {
  const ms = r.start ? Date.parse(r.start) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    const arr = out.get(k);
    if (arr) arr.push(it);
    else out.set(k, [it]);
  }
  return out;
}

export interface ValidationSummary {
  total: number;
  errorCount: number;
  warningCount: number;
  byField: Record<ValidationField, number>;
}

export function summarize(issues: ValidationIssue[]): ValidationSummary {
  const byField: Record<ValidationField, number> = {
    terminal: 0,
    berth: 0,
    time: 0,
    position: 0,
    clearance: 0,
  };
  let errorCount = 0;
  let warningCount = 0;
  for (const i of issues) {
    byField[i.field] += 1;
    if (i.severity === 'error') errorCount += 1;
    else warningCount += 1;
  }
  return { total: issues.length, errorCount, warningCount, byField };
}
