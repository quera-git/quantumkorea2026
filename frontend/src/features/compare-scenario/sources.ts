// 비교 슬롯에 들어갈 수 있는 source 의 enum + row 해석 헬퍼.

import type { SolverResultSlice } from '@/features/editor/editor.store';
import type { Assignment } from '@/shared/domain/types';

export type CompareSource = 'original' | 'edited' | 'result';

export interface SourceMeta {
  id: CompareSource;
  /** 사용자에게 보일 라벨. */
  label: string;
  /** 짧은 부연. */
  hint: string;
}

export const SOURCE_META: Record<CompareSource, SourceMeta> = {
  original: {
    id: 'original',
    label: '원본',
    hint: '시나리오 로드 직후 (편집 X)',
  },
  edited: {
    id: 'edited',
    label: '편집본',
    hint: '현재 editor 의 currentRows',
  },
  result: {
    id: 'result',
    label: '솔버 결과',
    hint: 'lastResult 의 stitched rows',
  },
};

export interface SourceContext {
  originalRows: Assignment[];
  currentRows: Assignment[];
  lastResult: SolverResultSlice | null;
}

/** 선택된 source 에 해당하는 rows 를 반환. result 없으면 null. */
export function rowsForSource(source: CompareSource, ctx: SourceContext): Assignment[] | null {
  switch (source) {
    case 'original':
      return ctx.originalRows;
    case 'edited':
      return ctx.currentRows;
    case 'result':
      return ctx.lastResult?.rows ?? null;
    default:
      return null;
  }
}

/** 그 source 가 비교에 사용 가능한 상태인지 (rows 가 비어있지 않은지 등). */
export function isSourceAvailable(source: CompareSource, ctx: SourceContext): boolean {
  const rows = rowsForSource(source, ctx);
  return rows !== null && rows.length > 0;
}
