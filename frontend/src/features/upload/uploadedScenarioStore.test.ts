import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';

import { useUploadedScenarioStore } from './uploadedScenarioStore';

function row(over: Partial<Assignment> = {}): Assignment {
  return {
    rowId: 'r-0',
    voyage: 'V',
    vessel: '',
    company: '',
    sectionRaw: '',
    terminal: 'SND',
    berth: 1,
    route: '',
    start: '2026-03-13T00:00:00',
    end: '2026-03-13T08:00:00',
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
    planStatus: null,
    ...over,
  };
}

function reset() {
  useUploadedScenarioStore.setState({ scenarios: [] });
  // persisted localStorage 도 비움.
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('uploaded-scenarios');
  }
}

describe('useUploadedScenarioStore', () => {
  beforeEach(reset);
  afterEach(reset);

  it('add → scenarios 배열 끝에 추가, uploadedAt 자동 채움', () => {
    const id = useUploadedScenarioStore.getState().add({
      id: 'upload-test',
      label: '테스트',
      sourceFile: 'a.json',
      rows: [row()],
      format: 'raw-rows',
      droppedInConversion: 0,
    });
    const state = useUploadedScenarioStore.getState().scenarios;
    expect(state).toHaveLength(1);
    expect(id).toBe('upload-test');
    expect(state[0]?.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('id 충돌 시 suffix -2, -3 자동', () => {
    const add = useUploadedScenarioStore.getState().add;
    const slice = {
      id: 'upload-x',
      label: 'X',
      sourceFile: 'a.json',
      rows: [row()],
      format: 'raw-rows' as const,
      droppedInConversion: 0,
    };
    const id1 = add(slice);
    const id2 = add(slice);
    const id3 = add(slice);
    expect(id1).toBe('upload-x');
    expect(id2).toBe('upload-x-2');
    expect(id3).toBe('upload-x-3');
  });

  it('label 충돌 시 "(2)", "(3)" 자동', () => {
    const add = useUploadedScenarioStore.getState().add;
    add({
      id: 'a',
      label: '같은 이름',
      sourceFile: '',
      rows: [row()],
      format: 'raw-rows',
      droppedInConversion: 0,
    });
    add({
      id: 'b',
      label: '같은 이름',
      sourceFile: '',
      rows: [row()],
      format: 'raw-rows',
      droppedInConversion: 0,
    });
    const labels = useUploadedScenarioStore.getState().scenarios.map((s) => s.label);
    expect(labels).toEqual(['같은 이름', '같은 이름 (2)']);
  });

  it('remove(id) → 해당 슬롯만 제거', () => {
    const add = useUploadedScenarioStore.getState().add;
    add({
      id: 'a',
      label: 'A',
      sourceFile: '',
      rows: [row()],
      format: 'raw-rows',
      droppedInConversion: 0,
    });
    add({
      id: 'b',
      label: 'B',
      sourceFile: '',
      rows: [row()],
      format: 'raw-rows',
      droppedInConversion: 0,
    });
    useUploadedScenarioStore.getState().remove('a');
    const ids = useUploadedScenarioStore.getState().scenarios.map((s) => s.id);
    expect(ids).toEqual(['b']);
  });

  it('clearAll → 전체 제거', () => {
    const add = useUploadedScenarioStore.getState().add;
    add({
      id: 'a',
      label: 'A',
      sourceFile: '',
      rows: [row()],
      format: 'raw-rows',
      droppedInConversion: 0,
    });
    useUploadedScenarioStore.getState().clearAll();
    expect(useUploadedScenarioStore.getState().scenarios).toEqual([]);
  });

  it('getById → 단일 조회 / 없으면 undefined', () => {
    const add = useUploadedScenarioStore.getState().add;
    add({
      id: 'find-me',
      label: 'F',
      sourceFile: '',
      rows: [row()],
      format: 'raw-rows',
      droppedInConversion: 0,
    });
    expect(useUploadedScenarioStore.getState().getById('find-me')?.label).toBe('F');
    expect(useUploadedScenarioStore.getState().getById('missing')).toBeUndefined();
  });
});
