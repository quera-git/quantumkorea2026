// 빌드 타임에 src/data/*.json 시나리오를 import 한다.
// xlsx 원본 → JSON 변환은 scripts/convert_scenarios.py (수동, 시나리오 변경 시 재실행).
//
// 동적 import 를 쓰면 lazy loading 도 가능하지만 MVP-1 단계에선 4개 시나리오 모두 즉시 로드해도
// 부담 없음 (각 ~12KB, 58 rows × 20 fields).

import { ScenarioPayloadSchema, type ScenarioPayload } from '@/shared/domain/types';

import before0313 from '@/data/before_0313_1430.json';
import after0313 from '@/data/after_0313_1610.json';
import before0316 from '@/data/before_0316_0800.json';
import after0316 from '@/data/after_0316_1006.json';

const RAW: Record<string, unknown> = {
  before_0313_1430: before0313,
  after_0313_1610: after0313,
  before_0316_0800: before0316,
  after_0316_1006: after0316,
};

export interface ScenarioMeta {
  id: string;
  label: string;
}

export const SCENARIO_LIST: ScenarioMeta[] = [
  { id: 'before_0313_1430', label: '0313 14:30 (편집 전)' },
  { id: 'after_0313_1610', label: '0313 16:10 (편집 후)' },
  { id: 'before_0316_0800', label: '0316 08:00 (편집 전)' },
  { id: 'after_0316_1006', label: '0316 10:06 (편집 후)' },
];

/** 시나리오 ID 로 풍부 Assignment 페이로드를 즉시 반환. zod 로 한 번 검증. */
export function loadScenario(id: string): ScenarioPayload {
  const raw = RAW[id];
  if (!raw) {
    throw new Error(`알 수 없는 시나리오 id: ${id}`);
  }
  return ScenarioPayloadSchema.parse(raw);
}
