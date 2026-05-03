// 시나리오 행을 좁히는 클라이언트측 view filter.
// status-allocation-berths/ui/sidebar.py 의 PERIOD/ROUTE/BERTH/ORDER 컨셉을 참고하되,
// 데이터에 실제로 있는 route 코드(NCK/SRS/...) 를 동적으로 다중 선택하는 형태로 단순화.

import type { Terminal } from '@/shared/domain/constants';
import type { Assignment } from '@/shared/domain/types';

export type TerminalFilter = 'ALL' | Terminal;
export type SortKey = 'start' | 'end' | 'berth' | 'voyage';
export type SortDir = 'asc' | 'desc';

export interface SearchFilter {
  terminal: TerminalFilter;
  /** 빈 Set 이면 모든 route 통과. */
  routes: Set<string>;
  /** ISO datetime. null 이면 lower bound 없음. */
  dateFrom: string | null;
  dateTo: string | null;
  sort: { key: SortKey; dir: SortDir };
}

export const DEFAULT_FILTER: SearchFilter = {
  terminal: 'ALL',
  routes: new Set(),
  dateFrom: null,
  dateTo: null,
  sort: { key: 'start', dir: 'asc' },
};

/** 데이터에 등장하는 route 코드 목록 (정렬). */
export function uniqueRoutes(rows: Assignment[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.route && r.route.trim()) set.add(r.route.trim());
  }
  return Array.from(set).sort();
}

/** 데이터에 등장하는 vessel 행이 있는 가장 이른/늦은 start/end timestamp. */
export function dataDateRange(rows: Assignment[]): { min: string; max: string } | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    if (r.start) {
      const t = Date.parse(r.start);
      if (Number.isFinite(t)) lo = Math.min(lo, t);
    }
    if (r.end) {
      const t = Date.parse(r.end);
      if (Number.isFinite(t)) hi = Math.max(hi, t);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { min: new Date(lo).toISOString(), max: new Date(hi).toISOString() };
}

/** filter 와 sort 를 적용한 새 배열을 반환 (입력 mutate X). */
export function applyFilter(rows: Assignment[], filter: SearchFilter): Assignment[] {
  const fromMs = filter.dateFrom ? Date.parse(filter.dateFrom) : null;
  const toMs = filter.dateTo ? Date.parse(filter.dateTo) : null;

  const passed = rows.filter((r) => {
    if (filter.terminal !== 'ALL' && r.terminal !== filter.terminal) return false;
    if (filter.routes.size > 0 && (!r.route || !filter.routes.has(r.route))) return false;

    if (fromMs != null) {
      // 행의 어느 일부라도 from 이후에 있어야 통과 (=end >= from).
      if (r.end == null) return false;
      const endMs = Date.parse(r.end);
      if (!Number.isFinite(endMs) || endMs < fromMs) return false;
    }
    if (toMs != null) {
      // 행의 어느 일부라도 to 이전에 있어야 통과 (=start <= to).
      if (r.start == null) return false;
      const startMs = Date.parse(r.start);
      if (!Number.isFinite(startMs) || startMs > toMs) return false;
    }
    return true;
  });

  return sortRows(passed, filter.sort);
}

function sortRows(rows: Assignment[], sort: SearchFilter['sort']): Assignment[] {
  const out = rows.slice();
  const dir = sort.dir === 'asc' ? 1 : -1;
  const cmp = (a: Assignment, b: Assignment): number => {
    switch (sort.key) {
      case 'start':
        return cmpNullableTime(a.start, b.start) * dir;
      case 'end':
        return cmpNullableTime(a.end, b.end) * dir;
      case 'berth': {
        const ta = a.terminal || '';
        const tb = b.terminal || '';
        if (ta !== tb) return ta < tb ? -1 * dir : 1 * dir;
        return (a.berth - b.berth) * dir;
      }
      case 'voyage':
        return a.voyage.localeCompare(b.voyage) * dir;
      default:
        return 0;
    }
  };
  return out.sort(cmp);
}

function cmpNullableTime(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // null → 뒤로
  if (b == null) return -1;
  const av = Date.parse(a);
  const bv = Date.parse(b);
  if (!Number.isFinite(av)) return 1;
  if (!Number.isFinite(bv)) return -1;
  return av - bv;
}

/** 사용자가 임의로 만진 부분이 있는지 (UI 의 reset 활성화 판정용). */
export function isFilterActive(f: SearchFilter): boolean {
  return (
    f.terminal !== 'ALL' ||
    f.routes.size > 0 ||
    f.dateFrom != null ||
    f.dateTo != null ||
    f.sort.key !== DEFAULT_FILTER.sort.key ||
    f.sort.dir !== DEFAULT_FILTER.sort.dir
  );
}
