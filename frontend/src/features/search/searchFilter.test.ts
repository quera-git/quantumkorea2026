import { describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';

import {
  DEFAULT_FILTER,
  applyFilter,
  dataDateRange,
  isFilterActive,
  uniqueRoutes,
  type SearchFilter,
} from './searchFilter';

function row(over: Partial<Assignment>): Assignment {
  return {
    rowId: 'r',
    voyage: 'V',
    vessel: '',
    company: '',
    sectionRaw: '',
    terminal: 'SND',
    berth: 1,
    route: 'NCK',
    start: '2026-03-13T00:00:00.000Z',
    end: '2026-03-13T08:00:00.000Z',
    eta: null,
    etbInt: null,
    etdInt: null,
    etaInt: null,
    f: 0,
    e: 200,
    length: 200,
    yanghaVan: 0,
    seonjeokVan: 0,
    shiftingVan: 0,
    workHours: null,
    ...over,
  };
}

function withRoutes(...codes: string[]): SearchFilter {
  return { ...DEFAULT_FILTER, routes: new Set(codes) };
}

describe('uniqueRoutes', () => {
  it('빈 배열 → []', () => {
    expect(uniqueRoutes([])).toEqual([]);
  });
  it('중복 제거 + 정렬', () => {
    const rows = [
      row({ rowId: 'a', route: 'SRS' }),
      row({ rowId: 'b', route: 'NCK' }),
      row({ rowId: 'c', route: 'NCK' }),
      row({ rowId: 'd', route: '' }),
    ];
    expect(uniqueRoutes(rows)).toEqual(['NCK', 'SRS']);
  });
});

describe('dataDateRange', () => {
  it('빈 → null', () => {
    expect(dataDateRange([])).toBeNull();
  });
  it('min start / max end 추출', () => {
    const rows = [
      row({ rowId: 'a', start: '2026-03-13T00:00:00.000Z', end: '2026-03-13T08:00:00.000Z' }),
      row({ rowId: 'b', start: '2026-03-15T00:00:00.000Z', end: '2026-03-16T00:00:00.000Z' }),
    ];
    const r = dataDateRange(rows)!;
    expect(r.min).toBe('2026-03-13T00:00:00.000Z');
    expect(r.max).toBe('2026-03-16T00:00:00.000Z');
  });
});

describe('applyFilter', () => {
  const sample: Assignment[] = [
    row({ rowId: 'a', terminal: 'SND', berth: 1, route: 'NCK', start: '2026-03-13T00:00:00.000Z', end: '2026-03-13T08:00:00.000Z' }),
    row({ rowId: 'b', terminal: 'GAM', berth: 8, route: 'SRS', start: '2026-03-14T00:00:00.000Z', end: '2026-03-14T12:00:00.000Z' }),
    row({ rowId: 'c', terminal: 'SND', berth: 3, route: 'KRX', start: '2026-03-16T00:00:00.000Z', end: '2026-03-17T00:00:00.000Z' }),
  ];

  it('기본 필터 → 변형 없이 정렬만 (start asc 기본)', () => {
    const out = applyFilter(sample, { ...DEFAULT_FILTER, routes: new Set() });
    expect(out.map((r) => r.rowId)).toEqual(['a', 'b', 'c']);
  });

  it('terminal=GAM → b 만 통과', () => {
    const out = applyFilter(sample, { ...DEFAULT_FILTER, terminal: 'GAM', routes: new Set() });
    expect(out.map((r) => r.rowId)).toEqual(['b']);
  });

  it('routes={NCK,KRX} → a, c 통과', () => {
    const out = applyFilter(sample, withRoutes('NCK', 'KRX'));
    expect(out.map((r) => r.rowId).sort()).toEqual(['a', 'c']);
  });

  it('dateFrom / dateTo 가 행 일부와 겹치면 통과', () => {
    const f: SearchFilter = {
      ...DEFAULT_FILTER,
      routes: new Set(),
      dateFrom: '2026-03-14T00:00:00.000Z',
      dateTo: '2026-03-15T23:59:59.000Z',
    };
    // a: end=03-13 → end<from → 제외
    // b: 03-14 ~ 03-14 → 통과
    // c: start=03-16 > to → 제외
    const out = applyFilter(sample, f);
    expect(out.map((r) => r.rowId)).toEqual(['b']);
  });

  it('sort key=berth desc → 터미널 역순(SND→GAM) + 같은 터미널 내 berth 역순', () => {
    const out = applyFilter(sample, {
      ...DEFAULT_FILTER,
      routes: new Set(),
      sort: { key: 'berth', dir: 'desc' },
    });
    // asc 자연순서: GAM-8 < SND-1 < SND-3 → desc 는 그 역순.
    // 결과: SND-3(c) → SND-1(a) → GAM-8(b)
    expect(out.map((r) => r.rowId)).toEqual(['c', 'a', 'b']);
  });

  it('sort key=voyage asc → 사전식 정렬', () => {
    const rows = [
      row({ rowId: 'a', voyage: 'C-1' }),
      row({ rowId: 'b', voyage: 'A-1' }),
      row({ rowId: 'c', voyage: 'B-1' }),
    ];
    const out = applyFilter(rows, {
      ...DEFAULT_FILTER,
      routes: new Set(),
      sort: { key: 'voyage', dir: 'asc' },
    });
    expect(out.map((r) => r.voyage)).toEqual(['A-1', 'B-1', 'C-1']);
  });

  it('terminal + routes + dateFrom 동시 적용', () => {
    const f: SearchFilter = {
      ...DEFAULT_FILTER,
      terminal: 'SND',
      routes: new Set(['KRX']),
      dateFrom: '2026-03-15T00:00:00.000Z',
    };
    const out = applyFilter(sample, f);
    expect(out.map((r) => r.rowId)).toEqual(['c']);
  });

  it('입력 배열은 mutate 안 함', () => {
    const before = sample.map((r) => r.rowId);
    applyFilter(sample, { ...DEFAULT_FILTER, routes: new Set(), sort: { key: 'voyage', dir: 'desc' } });
    expect(sample.map((r) => r.rowId)).toEqual(before);
  });
});

describe('isFilterActive', () => {
  it('기본 → false', () => {
    expect(isFilterActive({ ...DEFAULT_FILTER, routes: new Set() })).toBe(false);
  });
  it('terminal 변경 → true', () => {
    expect(isFilterActive({ ...DEFAULT_FILTER, terminal: 'SND', routes: new Set() })).toBe(true);
  });
  it('route 추가 → true', () => {
    expect(isFilterActive(withRoutes('NCK'))).toBe(true);
  });
  it('sort dir 변경 → true', () => {
    expect(
      isFilterActive({ ...DEFAULT_FILTER, routes: new Set(), sort: { key: 'start', dir: 'desc' } }),
    ).toBe(true);
  });
});
