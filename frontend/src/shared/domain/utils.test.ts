import { describe, expect, it } from 'vitest';

import { TERMINAL_LAYOUT } from './constants';
import {
  berthBandBounds,
  inferBerthFromY,
  inferTerminalFromBerth,
  rowCenterY,
  rowSpan,
  snapTimeMin,
  snapY30m,
  spanGapM,
  timeOverlap,
} from './utils';

describe('inferTerminalFromBerth', () => {
  it.each([
    [1, 'SND'],
    [3, 'SND'],
    [5, 'SND'],
    [6, 'GAM'],
    [9, 'GAM'],
    [0, ''],
    [10, ''],
    [null, ''],
  ])('berth=%s → %s', (b, expected) => {
    expect(inferTerminalFromBerth(b as number)).toBe(expected);
  });
});

describe('inferBerthFromY', () => {
  it('SND y=0 → berth 1', () => {
    expect(inferBerthFromY('SND', 0)).toBe(1);
  });
  it('SND y=300 → berth 2 (다음 step 시작)', () => {
    expect(inferBerthFromY('SND', 300)).toBe(2);
  });
  it('SND y=1499 → berth 5 (마지막)', () => {
    expect(inferBerthFromY('SND', 1499)).toBe(5);
  });
  it('SND y=1500 (정확히 yMax) → 마지막 berth 5 로 클램프', () => {
    expect(inferBerthFromY('SND', 1500)).toBe(5);
  });
  it('GAM y=0 → 라벨 순서상 berth 9 (top)', () => {
    expect(inferBerthFromY('GAM', 0)).toBe(9);
  });
  it('GAM y=1399 → berth 6 (bottom)', () => {
    expect(inferBerthFromY('GAM', 1399)).toBe(6);
  });
  it('null/NaN → null', () => {
    expect(inferBerthFromY('SND', null)).toBeNull();
    expect(inferBerthFromY('SND', Number.NaN)).toBeNull();
  });
});

describe('berthBandBounds', () => {
  it('SND berth 1 → [0, 300]', () => {
    expect(berthBandBounds('SND', 1)).toEqual([0, 300]);
  });
  it('SND berth 5 → [1200, 1500]', () => {
    expect(berthBandBounds('SND', 5)).toEqual([1200, 1500]);
  });
  it('GAM berth 9 (라벨 첫번째) → [0, 350]', () => {
    expect(berthBandBounds('GAM', 9)).toEqual([0, 350]);
  });
  it('GAM berth 6 (라벨 마지막) → [1050, 1400]', () => {
    expect(berthBandBounds('GAM', 6)).toEqual([1050, 1400]);
  });
});

describe('rowCenterY / rowSpan', () => {
  it('f=100, e=200 → center 150, span [100,200]', () => {
    expect(rowCenterY({ f: 100, e: 200 })).toBe(150);
    expect(rowSpan({ f: 100, e: 200 })).toEqual([100, 200]);
  });
  it('f>e 라도 span 은 정렬', () => {
    expect(rowSpan({ f: 200, e: 100 })).toEqual([100, 200]);
  });
  it('둘 다 null → [null, null]', () => {
    expect(rowSpan({ f: null, e: null })).toEqual([null, null]);
  });
});

describe('spanGapM', () => {
  it('떨어진 구간 → 양수 거리', () => {
    expect(spanGapM(0, 100, 200, 300)).toBe(100);
    expect(spanGapM(200, 300, 0, 100)).toBe(100);
  });
  it('접촉 → 0', () => {
    expect(spanGapM(0, 100, 100, 200)).toBe(0);
  });
  it('겹침 → 음수 (겹친 길이의 절댓값)', () => {
    expect(spanGapM(0, 100, 50, 150)).toBe(-50);
  });
});

describe('snapTimeMin', () => {
  it('5분 단위로 반올림', () => {
    expect(snapTimeMin('2026-03-13T14:32:00Z', 5)?.endsWith(':30:00.000Z')).toBe(true);
    expect(snapTimeMin('2026-03-13T14:33:00Z', 5)?.endsWith(':35:00.000Z')).toBe(true);
  });
  it('null 입력 → null', () => {
    expect(snapTimeMin(null)).toBeNull();
    expect(snapTimeMin('not-a-date')).toBeNull();
  });
});

describe('snapY30m', () => {
  it('30m 단위 반올림', () => {
    expect(snapY30m(0)).toBe(0);
    expect(snapY30m(15)).toBe(30); // 0.5 round-half 동작 확인
    expect(snapY30m(14)).toBe(0);
    expect(snapY30m(45)).toBe(60);
    expect(snapY30m(75)).toBe(90);
  });
});

describe('timeOverlap', () => {
  it('완전 분리 → false', () => {
    expect(
      timeOverlap('2026-03-13T00:00:00Z', '2026-03-13T01:00:00Z', '2026-03-13T02:00:00Z', '2026-03-13T03:00:00Z'),
    ).toBe(false);
  });
  it('접촉(end == start) → false (schema.py 동작)', () => {
    expect(
      timeOverlap('2026-03-13T00:00:00Z', '2026-03-13T01:00:00Z', '2026-03-13T01:00:00Z', '2026-03-13T02:00:00Z'),
    ).toBe(false);
  });
  it('일부 겹침 → true', () => {
    expect(
      timeOverlap('2026-03-13T00:00:00Z', '2026-03-13T02:00:00Z', '2026-03-13T01:00:00Z', '2026-03-13T03:00:00Z'),
    ).toBe(true);
  });
});

describe('TERMINAL_LAYOUT 일관성', () => {
  it('SND berths × step == yMax', () => {
    const l = TERMINAL_LAYOUT.SND;
    expect(l.berths.length * l.step).toBe(l.yMax);
  });
  it('GAM berths × step == yMax', () => {
    const l = TERMINAL_LAYOUT.GAM;
    expect(l.berths.length * l.step).toBe(l.yMax);
  });
});
