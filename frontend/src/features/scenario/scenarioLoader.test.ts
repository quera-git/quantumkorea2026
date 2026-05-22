import { describe, expect, it } from 'vitest';

import { SCENARIO_LIST, loadScenario } from './scenarioLoader';

describe('scenarioLoader (정적 시나리오 제거됨)', () => {
  it('SCENARIO_LIST 가 빈 배열', () => {
    expect(SCENARIO_LIST).toEqual([]);
  });

  it('loadScenario 호출 시 항상 throw', () => {
    expect(() => loadScenario('does-not-exist')).toThrow(/정적 시나리오/);
    expect(() => loadScenario('before_0313_1430')).toThrow(/제거됨/);
  });
});
