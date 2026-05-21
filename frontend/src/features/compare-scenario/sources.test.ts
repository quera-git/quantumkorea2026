import { describe, expect, it } from 'vitest';

import type { SolverResultSlice } from '@/features/editor/editor.store';
import type { Assignment } from '@/shared/domain/types';

import { isSourceAvailable, rowsForSource, type SourceContext } from './sources';

function row(over: Partial<Assignment>): Assignment {
  return {
    rowId: 'r',
    voyage: 'V',
    vessel: '',
    company: '',
    sectionRaw: '',
    terminal: 'SND',
    berth: 1,
    route: '',
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
    planStatus: null,
    ...over,
  };
}

const ORIG = [row({ rowId: 'a', voyage: 'V1' })];
const EDITED = [row({ rowId: 'a', voyage: 'V1', f: 30, e: 230 })];
const RESULT_ROWS = [row({ rowId: 'a-result', voyage: 'V1', f: 60, e: 260 })];

const RESULT: SolverResultSlice = {
  jobId: 'j1',
  solver: 'cqm',
  rows: RESULT_ROWS,
  referenceIso: '2026-03-13T00:00:00.000Z',
  unmatched: [],
  objectiveValue: 12.34,
  elapsedSeconds: 1.5,
  storedAt: '2026-03-13T01:00:00.000Z',
};

describe('rowsForSource', () => {
  it('original → originalRows', () => {
    const ctx: SourceContext = { originalRows: ORIG, currentRows: EDITED, lastResult: RESULT };
    expect(rowsForSource('original', ctx)?.[0]?.f).toBe(0);
  });
  it('edited → currentRows', () => {
    const ctx: SourceContext = { originalRows: ORIG, currentRows: EDITED, lastResult: RESULT };
    expect(rowsForSource('edited', ctx)?.[0]?.f).toBe(30);
  });
  it('result → lastResult.rows', () => {
    const ctx: SourceContext = { originalRows: ORIG, currentRows: EDITED, lastResult: RESULT };
    expect(rowsForSource('result', ctx)?.[0]?.f).toBe(60);
  });
  it('result 가 null 이면 result source 도 null', () => {
    const ctx: SourceContext = { originalRows: ORIG, currentRows: EDITED, lastResult: null };
    expect(rowsForSource('result', ctx)).toBeNull();
  });
});

describe('isSourceAvailable', () => {
  it('데이터 있는 source → true', () => {
    const ctx: SourceContext = { originalRows: ORIG, currentRows: EDITED, lastResult: RESULT };
    expect(isSourceAvailable('original', ctx)).toBe(true);
    expect(isSourceAvailable('edited', ctx)).toBe(true);
    expect(isSourceAvailable('result', ctx)).toBe(true);
  });
  it('result 없으면 result 만 false', () => {
    const ctx: SourceContext = { originalRows: ORIG, currentRows: EDITED, lastResult: null };
    expect(isSourceAvailable('original', ctx)).toBe(true);
    expect(isSourceAvailable('edited', ctx)).toBe(true);
    expect(isSourceAvailable('result', ctx)).toBe(false);
  });
  it('빈 배열도 false (데이터 없음 취급)', () => {
    const ctx: SourceContext = { originalRows: [], currentRows: EDITED, lastResult: RESULT };
    expect(isSourceAvailable('original', ctx)).toBe(false);
  });
});
