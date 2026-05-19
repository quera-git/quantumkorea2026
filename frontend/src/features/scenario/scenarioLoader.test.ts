import { describe, expect, it } from 'vitest';

import { SCENARIO_LIST, loadScenario } from './scenarioLoader';

describe('scenarioLoader', () => {
  it('SCENARIO_LIST 가 4개 시나리오 (before/after × 2일자)', () => {
    expect(SCENARIO_LIST).toHaveLength(4);
    const ids = SCENARIO_LIST.map((s) => s.id);
    expect(ids).toContain('before_0313_1430');
    expect(ids).toContain('after_0313_1610');
    expect(ids).toContain('before_0316_0800');
    expect(ids).toContain('after_0316_1006');
  });

  it.each(SCENARIO_LIST)('loadScenario("$id") 검증 통과', ({ id }) => {
    const s = loadScenario(id);
    expect(s.scenarioId).toBe(id);
    expect(s.rows.length).toBeGreaterThan(0);
    // 각 row 는 zod 가 검증한 풍부 도메인이라 필드가 다 있어야 함.
    const r = s.rows[0]!;
    expect(typeof r.voyage).toBe('string');
    expect(typeof r.berth).toBe('number');
    expect(['SND', 'GAM', '']).toContain(r.terminal);
  });

  it('존재하지 않는 id 는 throw', () => {
    expect(() => loadScenario('does-not-exist')).toThrow();
  });

  it('샘플 시나리오의 SND/GAM 분포가 0 이상', () => {
    const s = loadScenario('before_0313_1430');
    const snd = s.rows.filter((r) => r.terminal === 'SND').length;
    const gam = s.rows.filter((r) => r.terminal === 'GAM').length;
    expect(snd + gam).toBeGreaterThan(0);
  });
});
