// 4-way 비교 탭에서 "이 결과를 시나리오 pill 에 추가" 버튼으로 핀한 솔버 결과 id 들.
// uploadedScenarioStore 의 결과 시나리오들은 기본적으로 pill 에서 hidden (어수선 방지).
// 사용자가 특정 결과를 편집/검증/비교 탭에서 만지고 싶으면 핀 → pill 에 노출.
//
// localStorage persist — 사용자 선호 영속.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PinnedResultsState {
  /** 핀된 솔버 결과 시나리오 id 들 (예: 'scenario-1-cqm'). */
  pinned: string[];
  /** 토글 — 이미 있으면 제거, 없으면 추가. */
  toggle: (id: string) => void;
  /** 명시적 추가. */
  add: (id: string) => void;
  /** 명시적 제거. */
  remove: (id: string) => void;
  /** 전체 비우기. */
  clear: () => void;
}

export const usePinnedResults = create<PinnedResultsState>()(
  persist(
    (set, get) => ({
      pinned: [],
      toggle: (id) =>
        set({
          pinned: get().pinned.includes(id)
            ? get().pinned.filter((x) => x !== id)
            : [...get().pinned, id],
        }),
      add: (id) =>
        set({
          pinned: get().pinned.includes(id) ? get().pinned : [...get().pinned, id],
        }),
      remove: (id) => set({ pinned: get().pinned.filter((x) => x !== id) }),
      clear: () => set({ pinned: [] }),
    }),
    {
      name: 'pinned-results',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
