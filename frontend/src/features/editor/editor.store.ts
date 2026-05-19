// 드래그 에디터의 working state.
// originalRows: 시나리오 로드 직후 snapshot (audit 비교용, 수정 X).
// currentRows: 사용자 드래그/단축키로 편집 중인 working copy.
// history: undo/redo 용 currentRows 스냅샷 스택.
//
// 모든 이동(드래그 commit, arrow nudge, keyboard nudge) 은 결국 applyMove 한 곳을 거친다.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { inferBerthFromY } from '@/shared/domain';
import type { Assignment } from '@/shared/domain/types';

export interface MovePatch {
  /** ISO datetime. */
  start: string;
  /** ISO datetime. */
  end: string;
  f: number;
  e: number;
  berth: number;
}

/** 솔버 결과를 풍부 도메인으로 stitch 한 결과. */
export interface SolverResultSlice {
  jobId: string;
  solver: 'gurobi' | 'cqm' | 'hybrid';
  /** stitch 된 풍부 결과 행. originals 와 같은 voyage 에 같은 메타. */
  rows: Assignment[];
  /** stitch 시점의 reference (h=0 의 절대 시각). */
  referenceIso: string;
  /** 매칭 안 된 vessel_id 목록 (보통 빈 배열). */
  unmatched: string[];
  /** 솔버가 보고한 objective. */
  objectiveValue: number | null;
  /** 솔버 소요 (초). */
  elapsedSeconds: number | null;
  /** stitch 완료 시점. */
  storedAt: string;
}

interface EditorState {
  /** 마지막으로 loadSnapshot 한 시나리오 id (스냅샷 키). */
  scenarioId: string | null;
  /** 원본 (변경 X). */
  originalRows: Assignment[];
  /** 편집 working copy. */
  currentRows: Assignment[];
  /** 현재 선택된 행. 키보드/arrow nudge 의 대상. */
  selectedRowId: string | null;
  /** undo/redo 스택. 각 항목은 currentRows 의 깊은 복사. */
  history: Assignment[][];
  historyIndex: number;

  /** 마지막 solver 결과 (있으면). 시나리오/편집 변경 시 stale 안 되도록 reference 같이 보관. */
  lastResult: SolverResultSlice | null;

  // ---- selectors (computed via getter) ----
  /** dirty: originalRows 와 currentRows 가 다르면 true. */
  isDirty: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  selected: () => Assignment | null;

  // ---- actions ----
  loadSnapshot: (scenarioId: string, rows: Assignment[]) => void;
  selectRow: (rowId: string | null) => void;

  /** 드래그 commit 또는 직접 patch 적용. */
  applyMove: (rowId: string, patch: MovePatch) => void;
  /**
   * currentRows 전체를 새 배열로 교체. 솔버 결과를 편집기로 불러올 때 사용.
   * - originalRows 는 그대로 유지 → audit 비교는 여전히 "최초 원본 vs 현재" 의미.
   * - history 에 push 되어 undo/redo 가능.
   */
  replaceCurrentRows: (rows: Assignment[]) => void;
  /**
   * 선택 row 를 시간/y 만큼 미세 이동.
   * dMinutes/dY 는 원하는 이동량 (snap 적용됨).
   */
  nudgeSelected: (dMinutes: number, dY: number) => void;

  undo: () => void;
  redo: () => void;
  /** currentRows 를 originalRows 로 되돌림 + history 초기화. */
  reset: () => void;

  /** solver 결과 stitch 후 저장. */
  setResult: (slice: SolverResultSlice) => void;
  /** solver 결과 비우기 (시나리오 변경 등). */
  clearResult: () => void;
}

function deepCloneRows(rows: Assignment[]): Assignment[] {
  return rows.map((r) => ({ ...r }));
}

function rowsEqual(a: Assignment[], b: Assignment[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.rowId !== y.rowId ||
      x.start !== y.start ||
      x.end !== y.end ||
      x.f !== y.f ||
      x.e !== y.e ||
      x.berth !== y.berth ||
      x.terminal !== y.terminal
    ) {
      return false;
    }
  }
  return true;
}

export const useEditorStore = create<EditorState>()(
  devtools(
    (set, get) => ({
      scenarioId: null,
      originalRows: [],
      currentRows: [],
      selectedRowId: null,
      history: [],
      historyIndex: -1,
      lastResult: null,

      isDirty: () => !rowsEqual(get().originalRows, get().currentRows),
      canUndo: () => get().historyIndex > 0,
      canRedo: () => get().historyIndex < get().history.length - 1,
      selected: () => {
        const { selectedRowId, currentRows } = get();
        if (!selectedRowId) return null;
        return currentRows.find((r) => r.rowId === selectedRowId) ?? null;
      },

      loadSnapshot: (scenarioId, rows) => {
        const cloned = deepCloneRows(rows);
        set({
          scenarioId,
          originalRows: cloned,
          currentRows: deepCloneRows(rows),
          selectedRowId: null,
          history: [deepCloneRows(rows)],
          historyIndex: 0,
          // 시나리오 변경 시 이전 솔버 결과는 stale 이므로 clear.
          lastResult: null,
        });
      },

      selectRow: (rowId) => set({ selectedRowId: rowId }),

      applyMove: (rowId, patch) => {
        const { currentRows, history, historyIndex } = get();
        const idx = currentRows.findIndex((r) => r.rowId === rowId);
        if (idx < 0) return;
        const nextRows = currentRows.slice();
        const prev = nextRows[idx]!;
        nextRows[idx] = { ...prev, ...patch };

        // historyIndex 다음 위치 이후 가지치기 + 새 스냅샷 push
        const trimmed = history.slice(0, historyIndex + 1);
        trimmed.push(deepCloneRows(nextRows));

        set({
          currentRows: nextRows,
          history: trimmed,
          historyIndex: trimmed.length - 1,
        });
      },

      replaceCurrentRows: (rows) => {
        const { history, historyIndex } = get();
        const cloned = deepCloneRows(rows);
        const trimmed = history.slice(0, historyIndex + 1);
        trimmed.push(deepCloneRows(rows));
        set({
          currentRows: cloned,
          history: trimmed,
          historyIndex: trimmed.length - 1,
          // 선택은 보존하되, 그 rowId 가 새 rows 에 없으면 자연스럽게 selected() 가 null 반환.
        });
      },

      nudgeSelected: (dMinutes, dY) => {
        // arrow 버튼/키보드용 미세 이동.
        // 호출자는 이미 스냅 단위(±5분/±30m)로 dMinutes/dY 를 전달한다고 가정한다.
        // 길이/duration 은 보존, snap 은 적용하지 않음 (원본 값이 grid 위가 아닐 수도 있어 좌표 이동만).
        const { selectedRowId, currentRows } = get();
        if (!selectedRowId) return;
        const row = currentRows.find((r) => r.rowId === selectedRowId);
        if (!row) return;
        if (!row.start || !row.end || row.f == null || row.e == null) return;
        if (row.terminal !== 'SND' && row.terminal !== 'GAM') return;

        const newStart = new Date(Date.parse(row.start) + dMinutes * 60_000).toISOString();
        const newEnd = new Date(Date.parse(row.end) + dMinutes * 60_000).toISOString();
        const newF = row.f + dY;
        const newE = row.e + dY;
        const newMid = (newF + newE) / 2;
        const newBerth = inferBerthFromY(row.terminal, newMid) ?? row.berth;

        get().applyMove(selectedRowId, {
          start: newStart,
          end: newEnd,
          f: newF,
          e: newE,
          berth: newBerth,
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        set({
          historyIndex: newIndex,
          currentRows: deepCloneRows(history[newIndex]!),
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        set({
          historyIndex: newIndex,
          currentRows: deepCloneRows(history[newIndex]!),
        });
      },

      reset: () => {
        const { originalRows } = get();
        set({
          currentRows: deepCloneRows(originalRows),
          history: [deepCloneRows(originalRows)],
          historyIndex: 0,
          selectedRowId: null,
        });
      },

      setResult: (slice) => set({ lastResult: slice }),
      clearResult: () => set({ lastResult: null }),
    }),
    { name: 'editor-store' },
  ),
);
