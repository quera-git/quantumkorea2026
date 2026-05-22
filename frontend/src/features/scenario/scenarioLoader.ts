// 정적 시나리오는 더 이상 번들에 포함되지 않는다.
// 모든 시나리오는 라이브 BPTC 조회(LiveQueryPanel) 또는 파일 업로드(UploadButton)로
// 런타임 등록 — 이전엔 src/data/*.json 4개를 기본 pill 로 노출했으나, 진짜 운영 데이터가
// 들어오기로 했고 phase 11 의 "예시" 다운로드 메뉴가 demo/onboarding 을 담당하므로 redundant.
//
// 본 모듈은 후방 호환용 stub 만 유지 — SCENARIO_LIST 는 빈 배열,
// loadScenario 는 호출 시 throw. 향후 모듈 자체를 제거할 수 있음.

import type { ScenarioPayload } from '@/shared/domain/types';

export interface ScenarioMeta {
  id: string;
  label: string;
}

/** 정적 시나리오 리스트 — 항상 빈 배열. */
export const SCENARIO_LIST: ScenarioMeta[] = [];

/** 정적 시나리오는 없으므로 항상 throw. caller 는 이 함수를 호출하기 전에 ID 가 SCENARIO_LIST 에 있는지 확인. */
export function loadScenario(id: string): ScenarioPayload {
  throw new Error(
    `정적 시나리오 "${id}" 는 제거됨. 라이브 조회(LiveQueryPanel) 또는 업로드(UploadButton) 로 등록하세요.`,
  );
}
