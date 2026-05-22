import { describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';

import { diffRows, diffsToCsv, summarize } from './audit';

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

describe('diffRows', () => {
  it('변경 없으면 빈 배열', () => {
    const orig = [row({ rowId: 'a' }), row({ rowId: 'b' })];
    const edited = orig.map((r) => ({ ...r }));
    expect(diffRows(orig, edited)).toEqual([]);
  });

  it('start 만 바뀌면 1개 RowDiff + start 필드 + Δmin', () => {
    const orig = [row({ rowId: 'a' })];
    const edited = [
      row({ rowId: 'a', start: '2026-03-13T00:30:00.000Z', end: '2026-03-13T08:30:00.000Z' }),
    ];
    const out = diffRows(orig, edited);
    expect(out).toHaveLength(1);
    const d = out[0]!;
    expect(d.changedFields.map((c) => c.field).sort()).toEqual(['end', 'start']);
    expect(d.deltaMinutes).toBe(30);
    const startField = d.changedFields.find((c) => c.field === 'start')!;
    expect(startField.delta).toBe(30);
  });

  it('y(중심) 변화량 계산: f/e 둘 다 +30 → deltaY=+30', () => {
    const orig = [row({ rowId: 'a', f: 0, e: 200 })];
    const edited = [row({ rowId: 'a', f: 30, e: 230 })];
    const out = diffRows(orig, edited);
    expect(out[0]?.deltaY).toBe(30);
  });

  it('berth/terminal 변화도 잡힘', () => {
    const orig = [row({ rowId: 'a', terminal: 'SND', berth: 1 })];
    const edited = [row({ rowId: 'a', terminal: 'SND', berth: 2 })];
    const out = diffRows(orig, edited);
    expect(out).toHaveLength(1);
    expect(out[0]?.changedFields.some((c) => c.field === 'berth')).toBe(true);
  });

  it('rowId 매칭 안 되는 행은 무시 (삭제/추가는 미지원)', () => {
    const orig = [row({ rowId: 'a' })];
    const edited = [row({ rowId: 'b', start: '2026-03-13T01:00:00.000Z' })];
    expect(diffRows(orig, edited)).toEqual([]);
  });
});

describe('summarize', () => {
  it('변경 없음 → all zero', () => {
    const s = summarize([]);
    expect(s.changedRowCount).toBe(0);
    expect(s.totalMinutesMoved).toBe(0);
    expect(s.totalMetersMoved).toBe(0);
    expect(s.byField.start).toBe(0);
  });

  it('필드별 카운트 + |Δmin|/|Δm| 합', () => {
    const orig = [
      row({ rowId: 'a' }),
      row({ rowId: 'b', f: 0, e: 200 }),
    ];
    const edited = [
      // a: 시간 -30분
      row({
        rowId: 'a',
        start: '2026-03-12T23:30:00.000Z',
        end: '2026-03-13T07:30:00.000Z',
      }),
      // b: y +60m
      row({ rowId: 'b', f: 60, e: 260 }),
    ];
    const s = summarize(diffRows(orig, edited));
    expect(s.changedRowCount).toBe(2);
    expect(s.totalMinutesMoved).toBe(30);
    expect(s.totalMetersMoved).toBe(60);
    expect(s.byField.start).toBe(1);
    expect(s.byField.end).toBe(1);
    expect(s.byField.f).toBe(1);
    expect(s.byField.e).toBe(1);
  });
});

describe('diffsToCsv', () => {
  it('변경 없음 → 헤더만', () => {
    const csv = diffsToCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
    expect(csv).toContain('rowId,voyage,vessel');
  });

  it('헤더 + 각 변경 필드 1줄', () => {
    const orig = [row({ rowId: 'a', voyage: 'JKAH-6' })];
    const edited = [
      row({
        rowId: 'a',
        voyage: 'JKAH-6',
        start: '2026-03-13T00:30:00.000Z',
        end: '2026-03-13T08:30:00.000Z',
      }),
    ];
    const csv = diffsToCsv(diffRows(orig, edited));
    const lines = csv.split('\n');
    // 헤더 + start + end
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('field');
    expect(lines.some((l) => l.includes(',start,'))).toBe(true);
    expect(lines.some((l) => l.includes(',end,'))).toBe(true);
  });

  it('컴마/큰따옴표 포함 값은 quote 처리', () => {
    const orig = [row({ rowId: 'a', vessel: 'A,B "X"' })];
    const edited = [
      row({
        rowId: 'a',
        vessel: 'A,B "X"',
        start: '2026-03-13T00:30:00.000Z',
        end: '2026-03-13T08:30:00.000Z',
      }),
    ];
    const csv = diffsToCsv(diffRows(orig, edited));
    expect(csv).toContain('"A,B ""X"""');
  });
});
