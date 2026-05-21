// 우리 SearchBar / 풍부 도메인 ↔ 백엔드 crawler enum 매핑.
// 백엔드 crawler 의 berth enum: 'A'=전체 / 'S'=신선대 / 'G'=감만 (BPTC 사이트 v_gu 폼값 그대로).
// 그 외 enum (time/route) 은 동일.

import type { TerminalFilter } from '@/features/search/searchFilter';

/** 우리 frontend 의 terminal 필터 값 → 백엔드 crawler 의 berth 파라미터. */
export function terminalToBackendBerth(filter: TerminalFilter): string {
  switch (filter) {
    case 'SND':
      return 'S';
    case 'GAM':
      return 'G';
    case 'ALL':
    default:
      return 'A';
  }
}

/** 백엔드 라우터의 berth enum → 우리 terminal. */
export function backendBerthToTerminal(berth: string): TerminalFilter {
  if (berth === 'S') return 'SND';
  if (berth === 'G') return 'GAM';
  return 'ALL';
}

/** 우리 SearchBar 의 dateFrom/dateTo (ISO) 가 들어왔을 때 time enum 추론. */
export function inferTimeEnum(dateFrom: string | null, dateTo: string | null): {
  time: string;
  year1?: number;
  month1?: number;
  day1?: number;
  year2?: number;
  month2?: number;
  day2?: number;
} {
  // 범위가 명시되면 무조건 term + 년월일 분해.
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return {
      time: 'term',
      year1: from.getFullYear(),
      month1: from.getMonth() + 1,
      day1: from.getDate(),
      year2: to.getFullYear(),
      month2: to.getMonth() + 1,
      day2: to.getDate(),
    };
  }
  return { time: '3days' };
}
