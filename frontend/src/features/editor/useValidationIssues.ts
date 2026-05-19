// 에디터의 currentRows 기준으로 실시간 검증 결과를 제공하는 훅.
// 캔버스/패널 어디서든 호출 가능.

import { useMemo } from 'react';

import { validateAssignments, type ValidationIssue } from '@/features/validation/validation';

import { useEditorStore } from './editor.store';

export function useEditorIssues(): ValidationIssue[] {
  const rows = useEditorStore((s) => s.currentRows);
  return useMemo(() => validateAssignments(rows), [rows]);
}

/**
 * 검증에 걸린 모든 rowId 의 Set + rowId → 메시지 매핑.
 * 캔버스에서 invalid 강조 표시 / 툴팁에 사유 표시 용도.
 */
export function useEditorIssueIndex(): {
  invalidRowIds: Set<string>;
  messagesByRowId: Map<string, string[]>;
} {
  const issues = useEditorIssues();
  return useMemo(() => {
    const set = new Set<string>();
    const map = new Map<string, string[]>();
    for (const i of issues) {
      for (const rid of i.rowIds) {
        set.add(rid);
        const arr = map.get(rid);
        if (arr) arr.push(i.message);
        else map.set(rid, [i.message]);
      }
    }
    return { invalidRowIds: set, messagesByRowId: map };
  }, [issues]);
}
