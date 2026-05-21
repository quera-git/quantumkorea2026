import { describe, expect, it } from 'vitest';

import { backendBerthToTerminal, inferTimeEnum, terminalToBackendBerth } from './mapping';

describe('terminalToBackendBerth', () => {
  it('SND → S (신선대)', () => {
    expect(terminalToBackendBerth('SND')).toBe('S');
  });
  it('GAM → G (감만)', () => {
    expect(terminalToBackendBerth('GAM')).toBe('G');
  });
  it('ALL → A (전체)', () => {
    expect(terminalToBackendBerth('ALL')).toBe('A');
  });
});

describe('backendBerthToTerminal', () => {
  it('S → SND', () => {
    expect(backendBerthToTerminal('S')).toBe('SND');
  });
  it('G → GAM', () => {
    expect(backendBerthToTerminal('G')).toBe('GAM');
  });
  it('A → ALL', () => {
    expect(backendBerthToTerminal('A')).toBe('ALL');
  });
  it('unknown → ALL', () => {
    expect(backendBerthToTerminal('?')).toBe('ALL');
  });
});

describe('inferTimeEnum', () => {
  it('범위 둘 다 없으면 3days default', () => {
    expect(inferTimeEnum(null, null).time).toBe('3days');
  });
  it('둘 다 있으면 term + 년/월/일 분해', () => {
    const out = inferTimeEnum('2026-03-13T00:00:00.000Z', '2026-03-19T23:59:59.000Z');
    expect(out.time).toBe('term');
    expect(out.year1).toBe(2026);
    expect(out.month1).toBe(3);
    expect(out.day1).toBeGreaterThanOrEqual(12); // 시간대 변환 영향 — 12 또는 13
    expect(out.year2).toBe(2026);
    expect(out.month2).toBe(3);
  });
});
