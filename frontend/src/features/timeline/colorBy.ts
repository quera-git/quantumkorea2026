// 타임라인/에디터 막대 fill 색의 분류 기준.
//   status: PlanStatus 4색 (Streamlit SoT — 운영 의미 보존)
//   voyage: 모선항차 해시 색 (식별/추적용)
//
// 사용자 선택은 localStorage 에 보관 ('color-by') — 라이브/정적 시나리오 공통.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ColorByMode = 'status' | 'voyage';

interface ColorByState {
  mode: ColorByMode;
  set: (m: ColorByMode) => void;
}

export const useColorBy = create<ColorByState>()(
  persist(
    (set) => ({
      mode: 'status',
      set: (mode) => set({ mode }),
    }),
    {
      name: 'color-by',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
