import { describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';

import { summarize, validateAssignments } from './validation';

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
    start: '2026-03-13T00:00:00',
    end: '2026-03-13T08:00:00',
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

describe('validateAssignments', () => {
  it('정상 행은 issue 없음', () => {
    const issues = validateAssignments([row({})]);
    expect(issues).toHaveLength(0);
  });

  it('terminal 이 SND/GAM 아니면 terminal 에러', () => {
    const issues = validateAssignments([row({ terminal: '' as 'SND', berth: 1 })]);
    expect(issues.some((i) => i.field === 'terminal' && i.severity === 'error')).toBe(true);
  });

  it('SND 인데 berth 6 → berth 범위 위반', () => {
    const issues = validateAssignments([row({ terminal: 'SND', berth: 6, f: 0, e: 200 })]);
    expect(issues.some((i) => i.field === 'berth' && /1~5/.test(i.message))).toBe(true);
  });

  it('GAM 인데 berth 3 → berth 범위 위반', () => {
    const issues = validateAssignments([row({ terminal: 'GAM', berth: 3, f: 0, e: 200 })]);
    expect(issues.some((i) => i.field === 'berth' && /6~9/.test(i.message))).toBe(true);
  });

  it('start >= end → time 에러', () => {
    const issues = validateAssignments([
      row({ start: '2026-03-13T08:00:00', end: '2026-03-13T08:00:00' }),
    ]);
    expect(issues.some((i) => i.field === 'time')).toBe(true);
  });

  it('start/end null → time 에러', () => {
    const issues = validateAssignments([row({ start: null, end: null })]);
    expect(issues.some((i) => i.field === 'time')).toBe(true);
  });

  it('SND f/e 가 yMax 초과 → position 에러', () => {
    const issues = validateAssignments([row({ terminal: 'SND', berth: 5, f: 1300, e: 1600 })]);
    expect(issues.some((i) => i.field === 'position')).toBe(true);
  });

  it('berth 와 위치(y_m) 불일치 → berth warning', () => {
    // f=0, e=200 → mid 100 → SND 에서 berth 1 로 추론. 데이터를 berth 2 로 저장해두면 mismatch.
    const issues = validateAssignments([row({ terminal: 'SND', berth: 2, f: 0, e: 200 })]);
    const w = issues.find((i) => i.field === 'berth' && i.severity === 'warning');
    expect(w).toBeDefined();
    expect(w?.message).toContain('1');
    expect(w?.message).toContain('2');
  });

  it('clearance: 같은 berth 시간 겹침 + gap < 30m → clearance 에러', () => {
    const a = row({
      rowId: 'a',
      terminal: 'SND',
      berth: 1,
      f: 0,
      e: 100,
      start: '2026-03-13T00:00:00',
      end: '2026-03-13T08:00:00',
    });
    const b = row({
      rowId: 'b',
      voyage: 'V2',
      terminal: 'SND',
      berth: 1,
      f: 110, // a 의 e=100 과 gap=10m, 30m 미만
      e: 200,
      start: '2026-03-13T04:00:00',
      end: '2026-03-13T12:00:00',
    });
    const issues = validateAssignments([a, b]);
    const c = issues.find((i) => i.field === 'clearance');
    expect(c).toBeDefined();
    expect(c?.target).toBe('SND-1');
    expect(c?.rowIds).toEqual(expect.arrayContaining(['a', 'b']));
    expect(c?.severity).toBe('error');
  });

  it('clearance: 시간 안 겹치면 gap 작아도 OK', () => {
    const a = row({
      rowId: 'a',
      terminal: 'SND',
      berth: 1,
      f: 0,
      e: 100,
      start: '2026-03-13T00:00:00',
      end: '2026-03-13T04:00:00',
    });
    const b = row({
      rowId: 'b',
      voyage: 'V2',
      terminal: 'SND',
      berth: 1,
      f: 105,
      e: 200,
      start: '2026-03-13T05:00:00',
      end: '2026-03-13T09:00:00',
    });
    const issues = validateAssignments([a, b]);
    expect(issues.some((i) => i.field === 'clearance')).toBe(false);
  });
});

describe('summarize', () => {
  it('0건 → all zero', () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.errorCount).toBe(0);
    expect(s.warningCount).toBe(0);
    expect(s.byField.terminal).toBe(0);
  });

  it('field 별 카운트 + severity 분리', () => {
    const issues = validateAssignments([
      // 한 행: terminal, berth, position 동시 위반 + position 추가
      {
        rowId: 'x',
        voyage: 'X',
        vessel: '',
        company: '',
        sectionRaw: '',
        terminal: '' as 'SND',
        berth: 7,
        route: '',
        start: '2026-03-13T08:00:00',
        end: '2026-03-13T07:00:00', // start>=end
        eta: null,
        etbInt: null,
        etdInt: null,
        etaInt: null,
        f: -10,
        e: 200,
        length: 210,
        yanghaVan: 0,
        seonjeokVan: 0,
        shiftingVan: 0,
        workHours: null,
        planStatus: null,
      },
    ]);
    const s = summarize(issues);
    expect(s.total).toBe(issues.length);
    expect(s.errorCount + s.warningCount).toBe(issues.length);
  });
});
