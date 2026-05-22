// 사용자가 업로드한 시나리오 보관 — 새로고침 후에도 유지하기 위해 localStorage persist.
//
// 정책:
//   - 여러 슬롯 (배열). 등록 순서대로 ScenarioPanel pill 에 노출.
//   - 한 슬롯당 ~1MB 한도. 새 슬롯 추가 시 localStorage 5MB 초과하면 가장 오래된 슬롯
//     자동 제거 (FIFO) 후 재시도. 사용자에게 toast 로 알림 (caller 책임).
//   - id 충돌 시 자동 suffix (`-2`, `-3`). label 충돌도 동일.
//   - delete 는 단일 슬롯. clearAll 은 전체.

import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import type { Assignment } from '@/shared/domain/types';

export interface UploadedScenarioSlice {
  id: string;
  label: string;
  sourceFile: string;
  rows: Assignment[];
  /** 업로드 시각 (ISO). 최신순 정렬 / 자동 제거 기준. */
  uploadedAt: string;
  /** 입력 포맷 — 디버그/통계용. */
  format: 'scenario-payload' | 'raw-rows' | 'bpt-raw-xlsx' | 'streamlit-xlsx';
  /** 변환 중 누락된 행 수 (raw-rows / xlsx 인 경우 의미 있음). */
  droppedInConversion: number;
}

interface UploadedScenarioState {
  scenarios: UploadedScenarioSlice[];

  /** 추가. id 충돌 시 자동 suffix 적용한 최종 id 반환. */
  add: (slice: Omit<UploadedScenarioSlice, 'uploadedAt'>) => string;
  /** 단일 슬롯 제거. */
  remove: (id: string) => void;
  /** 전체 제거. */
  clearAll: () => void;
  /** id 로 단일 조회. */
  getById: (id: string) => UploadedScenarioSlice | undefined;
}

function uniqueId(base: string, existing: ReadonlyArray<{ id: string }>): string {
  const ids = new Set(existing.map((x) => x.id));
  if (!ids.has(base)) return base;
  let n = 2;
  while (ids.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function uniqueLabel(base: string, existing: ReadonlyArray<{ label: string }>): string {
  const labels = new Set(existing.map((x) => x.label));
  if (!labels.has(base)) return base;
  let n = 2;
  while (labels.has(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}

export const useUploadedScenarioStore = create<UploadedScenarioState>()(
  devtools(
    persist(
      (set, get) => ({
        scenarios: [],

        add: (slice) => {
          const existing = get().scenarios;
          const id = uniqueId(slice.id, existing);
          const label = uniqueLabel(slice.label, existing);
          const next: UploadedScenarioSlice = {
            ...slice,
            id,
            label,
            uploadedAt: new Date().toISOString(),
          };
          set({ scenarios: [...existing, next] });
          return id;
        },

        remove: (id) => {
          set({ scenarios: get().scenarios.filter((s) => s.id !== id) });
        },

        clearAll: () => set({ scenarios: [] }),

        getById: (id) => get().scenarios.find((s) => s.id === id),
      }),
      {
        name: 'uploaded-scenarios',
        storage: createJSONStorage(() => localStorage),
        // 버전 — 스키마 변경 시 increment.
        version: 1,
      },
    ),
    { name: 'uploaded-scenario-store' },
  ),
);
