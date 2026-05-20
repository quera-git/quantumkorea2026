// 라이브 크롤링으로 가져온 시나리오를 in-memory 보관.
// scenarioLoader 가 정적 JSON 만 다루던 것과 별개의 source. ScenarioPanel 이 둘 다 합쳐 pill 노출.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { Assignment } from '@/shared/domain/types';

export interface LiveScenarioSlice {
  /** 시나리오 식별자. 항상 `live-{timestamp}` 형식. */
  id: string;
  label: string;
  /** 풍부 도메인 행. */
  rows: Assignment[];
  /** crawler 호출 파라미터 (재조회용). */
  params: {
    time: string;
    route: string;
    berth: string;
  };
  /** 가져온 시각 (ISO). */
  fetchedAt: string;
  /** 백엔드가 알린 추가 정보. */
  meta: {
    crawled: number;
    saved: number;
    skipped: number;
    droppedInConversion: number;
  };
}

interface LiveScenarioState {
  /** 가장 최근에 fetch 한 라이브 시나리오. (단일 슬롯 — 매번 덮어쓰기) */
  current: LiveScenarioSlice | null;

  setLive: (slice: LiveScenarioSlice) => void;
  clearLive: () => void;
}

export const useLiveScenarioStore = create<LiveScenarioState>()(
  devtools(
    (set) => ({
      current: null,
      setLive: (slice) => set({ current: slice }),
      clearLive: () => set({ current: null }),
    }),
    { name: 'live-scenario-store' },
  ),
);
