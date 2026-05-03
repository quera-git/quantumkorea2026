import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';

import { useEditorStore } from './editor.store';

function row(over: Partial<Assignment>): Assignment {
  return {
    rowId: 'r-default',
    voyage: 'V',
    vessel: '',
    company: '',
    sectionRaw: '',
    terminal: 'SND',
    berth: 1,
    route: '',
    start: '2026-03-13T00:00:00.000Z',
    end: '2026-03-13T08:00:00.000Z',
    eta: null,
    etbInt: null,
    etdInt: null,
    etaInt: null,
    f: 0,
    e: 200,
    length: 200,
    yanghaVan: 0,
    seonjeokVan: 0,
    shiftingVan: 0,
    workHours: null,
    ...over,
  };
}

function freshStore() {
  // zustand store reset between tests
  useEditorStore.setState({
    scenarioId: null,
    originalRows: [],
    currentRows: [],
    selectedRowId: null,
    history: [],
    historyIndex: -1,
  });
}

describe('useEditorStore', () => {
  beforeEach(freshStore);
  afterEach(freshStore);

  it('loadSnapshot 후 currentRows 와 originalRows 가 동일하지만 별개 인스턴스', () => {
    const r = row({ rowId: 'a' });
    useEditorStore.getState().loadSnapshot('s1', [r]);
    const s = useEditorStore.getState();
    expect(s.scenarioId).toBe('s1');
    expect(s.currentRows).toHaveLength(1);
    expect(s.originalRows).toHaveLength(1);
    expect(s.currentRows[0]).not.toBe(s.originalRows[0]);
    expect(s.isDirty()).toBe(false);
    expect(s.history).toHaveLength(1);
    expect(s.historyIndex).toBe(0);
  });

  it('applyMove 가 row 를 수정하고 history 를 push 한다', () => {
    useEditorStore.getState().loadSnapshot('s1', [row({ rowId: 'a' })]);
    useEditorStore.getState().applyMove('a', {
      start: '2026-03-13T01:00:00.000Z',
      end: '2026-03-13T09:00:00.000Z',
      f: 30,
      e: 230,
      berth: 1,
    });
    const s = useEditorStore.getState();
    expect(s.currentRows[0]?.f).toBe(30);
    expect(s.currentRows[0]?.start).toBe('2026-03-13T01:00:00.000Z');
    expect(s.history).toHaveLength(2);
    expect(s.historyIndex).toBe(1);
    expect(s.isDirty()).toBe(true);
    // originalRows 는 안 바뀜
    expect(s.originalRows[0]?.f).toBe(0);
  });

  it('undo / redo 가 정상 동작', () => {
    useEditorStore.getState().loadSnapshot('s1', [row({ rowId: 'a' })]);
    useEditorStore.getState().applyMove('a', {
      start: '2026-03-13T01:00:00.000Z',
      end: '2026-03-13T09:00:00.000Z',
      f: 30,
      e: 230,
      berth: 1,
    });
    expect(useEditorStore.getState().canUndo()).toBe(true);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().currentRows[0]?.f).toBe(0);
    expect(useEditorStore.getState().isDirty()).toBe(false);
    expect(useEditorStore.getState().canRedo()).toBe(true);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().currentRows[0]?.f).toBe(30);
    expect(useEditorStore.getState().canRedo()).toBe(false);
  });

  it('새 applyMove 는 redo 갈래를 가지치기', () => {
    useEditorStore.getState().loadSnapshot('s1', [row({ rowId: 'a' })]);
    useEditorStore.getState().applyMove('a', {
      start: '2026-03-13T01:00:00.000Z',
      end: '2026-03-13T09:00:00.000Z',
      f: 30,
      e: 230,
      berth: 1,
    });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().canRedo()).toBe(true);
    useEditorStore.getState().applyMove('a', {
      start: '2026-03-13T02:00:00.000Z',
      end: '2026-03-13T10:00:00.000Z',
      f: 60,
      e: 260,
      berth: 1,
    });
    // 새 가지가 생겼고 redo 는 더 이상 불가
    expect(useEditorStore.getState().canRedo()).toBe(false);
    expect(useEditorStore.getState().currentRows[0]?.f).toBe(60);
  });

  it('reset 으로 originalRows 로 복귀 + history 초기화', () => {
    useEditorStore.getState().loadSnapshot('s1', [row({ rowId: 'a' })]);
    useEditorStore.getState().applyMove('a', {
      start: '2026-03-13T01:00:00.000Z',
      end: '2026-03-13T09:00:00.000Z',
      f: 30,
      e: 230,
      berth: 1,
    });
    expect(useEditorStore.getState().isDirty()).toBe(true);
    useEditorStore.getState().reset();
    expect(useEditorStore.getState().isDirty()).toBe(false);
    expect(useEditorStore.getState().history).toHaveLength(1);
    expect(useEditorStore.getState().selectedRowId).toBeNull();
  });

  it('nudgeSelected 가 시간 +5분 / y -30m 로 row 를 이동 + berth 재추론', () => {
    useEditorStore.getState().loadSnapshot('s1', [
      row({ rowId: 'a', terminal: 'SND', berth: 1, f: 0, e: 200 }),
    ]);
    useEditorStore.getState().selectRow('a');
    // 시간 +5분
    useEditorStore.getState().nudgeSelected(5, 0);
    let r = useEditorStore.getState().currentRows[0]!;
    expect(r.start).toContain('00:05');
    expect(r.end).toContain('08:05');

    // y +300m → mid 변경 → berth 재추론 (SND y=400 → berth 2 영역)
    useEditorStore.getState().nudgeSelected(0, 300);
    r = useEditorStore.getState().currentRows[0]!;
    expect(r.f).toBe(300);
    expect(r.e).toBe(500);
    expect(r.berth).toBe(2);
  });

  it('nudgeSelected 는 선택 없으면 no-op', () => {
    useEditorStore.getState().loadSnapshot('s1', [row({ rowId: 'a' })]);
    useEditorStore.getState().nudgeSelected(5, 0);
    expect(useEditorStore.getState().isDirty()).toBe(false);
  });

  it('selectRow 로 selected getter 가 매칭된 row 반환', () => {
    useEditorStore.getState().loadSnapshot('s1', [
      row({ rowId: 'a', voyage: 'A1' }),
      row({ rowId: 'b', voyage: 'B1' }),
    ]);
    useEditorStore.getState().selectRow('b');
    expect(useEditorStore.getState().selected()?.voyage).toBe('B1');
    useEditorStore.getState().selectRow(null);
    expect(useEditorStore.getState().selected()).toBeNull();
  });

  it('동일 시나리오 재로드 시 rows 새로 클론된다', () => {
    const initial = [row({ rowId: 'a', f: 0, e: 200 })];
    useEditorStore.getState().loadSnapshot('s1', initial);
    useEditorStore.getState().applyMove('a', {
      start: '2026-03-13T01:00:00.000Z',
      end: '2026-03-13T09:00:00.000Z',
      f: 60,
      e: 260,
      berth: 1,
    });
    expect(useEditorStore.getState().isDirty()).toBe(true);
    useEditorStore.getState().loadSnapshot('s1', initial);
    expect(useEditorStore.getState().isDirty()).toBe(false);
    expect(useEditorStore.getState().currentRows[0]?.f).toBe(0);
  });
});
