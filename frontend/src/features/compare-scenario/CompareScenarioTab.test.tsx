import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from '@/features/editor/editor.store';
import type { Assignment } from '@/shared/domain/types';
import { renderWithProviders } from '@/test/renderWithProviders';

import { CompareScenarioTab } from './CompareScenarioTab';

function row(over: Partial<Assignment>): Assignment {
  return {
    rowId: 'r',
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
    planStatus: null,
    ...over,
  };
}

function freshStore() {
  useEditorStore.setState({
    scenarioId: null,
    originalRows: [],
    currentRows: [],
    selectedRowId: null,
    history: [],
    historyIndex: -1,
    lastResult: null,
  });
}

describe('<CompareScenarioTab />', () => {
  beforeEach(freshStore);
  afterEach(freshStore);

  it('기본 view: 좌=원본 / 우=편집본 (둘 다 동일 데이터면 diff 0)', async () => {
    const rows = [row({ rowId: 'a', voyage: 'V1' })];
    useEditorStore.getState().loadSnapshot('s1', rows);

    renderWithProviders(<CompareScenarioTab scenarioRows={rows} />);

    // 좌측 슬롯 라벨 / 우측 라벨 / Diff 라벨 모두 보여야 함
    expect(screen.getAllByText('원본').length).toBeGreaterThan(0);
    expect(screen.getAllByText('편집본').length).toBeGreaterThan(0);
    // Diff 라벨 — "원본 → 편집본"
    expect(screen.getByText(/원본.*→.*편집본/)).toBeInTheDocument();
    // 편집 안 했으니 변경 사항 0 → "변경 사항이 없습니다" 메시지
    expect(screen.getByText(/변경 사항이 없습니다/)).toBeInTheDocument();
  });

  it('result 가 없으면 result 버튼 disabled', () => {
    const rows = [row({ rowId: 'a', voyage: 'V1' })];
    useEditorStore.getState().loadSnapshot('s1', rows);

    renderWithProviders(<CompareScenarioTab scenarioRows={rows} />);

    // 좌/우 양쪽에 '솔버 결과' 버튼이 있고 disabled 여야 함
    const resultButtons = screen
      .getAllByRole('button', { name: '솔버 결과' });
    expect(resultButtons.length).toBe(2);
    resultButtons.forEach((b) => expect(b).toBeDisabled());
  });

  it('우측 source 를 편집본 → 솔버결과 로 변경', async () => {
    const user = userEvent.setup();
    const rows = [row({ rowId: 'a', voyage: 'V1', f: 0, e: 200 })];
    useEditorStore.getState().loadSnapshot('s1', rows);
    useEditorStore.getState().setResult({
      jobId: 'j1',
      solver: 'cqm',
      rows: [row({ rowId: 'a-result', voyage: 'V1', f: 60, e: 260 })],
      referenceIso: '2026-03-13T00:00:00.000Z',
      unmatched: [],
      objectiveValue: 1,
      elapsedSeconds: 1,
      storedAt: '2026-03-13T01:00:00.000Z',
    });

    renderWithProviders(<CompareScenarioTab scenarioRows={rows} />);

    // 우측 slot 의 '솔버 결과' 버튼 (두 번째 = R-result) 클릭
    const allResultButtons = screen.getAllByRole('button', { name: '솔버 결과' });
    expect(allResultButtons.length).toBe(2);
    const rightResultBtn = allResultButtons[1]!;
    expect(rightResultBtn).not.toBeDisabled();
    await user.click(rightResultBtn);

    // diff 라벨이 "원본 → 솔버 결과" 로 갱신
    expect(screen.getByText(/원본.*→.*솔버 결과/)).toBeInTheDocument();
  });
});
