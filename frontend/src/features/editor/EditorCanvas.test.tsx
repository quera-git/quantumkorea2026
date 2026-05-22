// EditorCanvas 의 hover / click / drag 통합 테스트.
//
// 핵심:
//   - 막대 호버 → VesselHoverCard (role="tooltip") 등장 / leave 시 사라짐
//   - 호버 시 issues 가 있으면 ⚠ 카운트 노출
//   - 막대 클릭(포인터 3px 미만 이동) → VesselDetailDialog 열림
//   - 막대 드래그(포인터 3px 이상 이동 + snap 결과 변경) → Dialog 안 열림, applyMove 호출
//
// `moved` 판정이 pointerMoved (3px) 가드를 거치므로 snap 노이즈로 인한 오분류 없음 →
// jsdom 의 svgRect=0 환경에서도 안정적으로 검증 가능.

import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * jsdom 의 PointerEvent constructor 는 init dict 의 clientX/clientY 를 무시해버려
 * 그냥 fireEvent.pointerMove(window, {clientX: 600}) 식으로 호출하면 listener 안에서
 * evt.clientX = 0 으로 들어온다. 직접 dispatch + defineProperty 로 강제 + act 로 감쌈.
 */
function dispatchPointer(
  target: Window | Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointerenter' | 'pointerleave',
  { clientX = 0, clientY = 0, pointerId = 1 }: { clientX?: number; clientY?: number; pointerId?: number } = {},
) {
  const ev = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId });
  Object.defineProperty(ev, 'clientX', { get: () => clientX });
  Object.defineProperty(ev, 'clientY', { get: () => clientY });
  act(() => {
    target.dispatchEvent(ev);
  });
}

import type { Assignment } from '@/shared/domain/types';
import { renderWithProviders } from '@/test/renderWithProviders';

import { useEditorStore } from './editor.store';
import { EditorCanvas } from './EditorCanvas';

function row(over: Partial<Assignment> = {}): Assignment {
  return {
    rowId: 'r-1',
    voyage: 'JKAH-6',
    vessel: 'KAI HANG 5',
    company: 'DYS',
    sectionRaw: '신선대',
    terminal: 'SND',
    berth: 1,
    route: 'NCK',
    start: '2026-05-19T12:00:00.000Z',
    end: '2026-05-19T18:00:00.000Z',
    eta: null,
    etbInt: null,
    etdInt: null,
    etaInt: null,
    // baseY = (f+e)/2 가 SND snap step(30m) 의 배수여야 jsdom 의 svgRect=0 환경에서
    // "클릭 = 이동 0" 판정이 안정적으로 false 가 된다. (90 = 30*3 → snap 노이즈 0)
    f: 0,
    e: 180,
    length: 180,
    yanghaVan: 30,
    seonjeokVan: 300,
    shiftingVan: 0,
    workHours: 6,
    planStatus: 'crane_assigned',
    ...over,
  };
}

function freshStore() {
  useEditorStore.setState({
    scenarioId: 'test',
    originalRows: [],
    currentRows: [],
    selectedRowId: null,
    history: [],
    historyIndex: -1,
  });
}

function getBar(): SVGRectElement {
  // 막대 사각형 = <rect aria-label="...">. berth label 등 다른 rect 와 구분하려면 aria-label 사용.
  const bars = screen
    .getAllByRole('img')
    .flatMap((svg) => Array.from(svg.querySelectorAll('rect[aria-label]')));
  expect(bars.length).toBeGreaterThan(0);
  return bars[0] as SVGRectElement;
}

describe('EditorCanvas hover/click', () => {
  beforeEach(freshStore);
  afterEach(freshStore);

  it('막대 호버 시 VesselHoverCard 노출, 떼면 사라짐', () => {
    const rows = [row()];
    renderWithProviders(<EditorCanvas assignments={rows} />);
    const bar = getBar();

    fireEvent.pointerEnter(bar, { clientX: 100, clientY: 100 });
    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText('JKAH-6')).toBeInTheDocument();

    fireEvent.pointerLeave(bar);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('막대 클릭 (포인터 3px 미만 이동) → VesselDetailDialog 열림', () => {
    const rows = [row()];
    renderWithProviders(<EditorCanvas assignments={rows} />);
    const bar = getBar();

    dispatchPointer(bar, 'pointerdown', { clientX: 100, clientY: 100 });
    dispatchPointer(window, 'pointerup', { clientX: 100, clientY: 100 });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getAllByText(/JKAH-6/).length).toBeGreaterThan(0);
  });

  it('1~2px 미세 이동 → 여전히 클릭 (snap 노이즈 무시)', () => {
    const rows = [row()];
    renderWithProviders(<EditorCanvas assignments={rows} />);
    const bar = getBar();

    dispatchPointer(bar, 'pointerdown', { clientX: 100, clientY: 100 });
    // 2px 만 이동 — pointerMoved 가드(3px) 못 넘김 → 클릭으로 처리.
    dispatchPointer(window, 'pointerup', { clientX: 102, clientY: 100 });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('막대 드래그 (포인터 큰 이동) → Dialog 안 열림 + applyMove 로 store 갱신', () => {
    const initial = row();
    useEditorStore.setState({
      scenarioId: 'test',
      originalRows: [initial],
      currentRows: [initial],
      selectedRowId: null,
      history: [],
      historyIndex: -1,
    });
    renderWithProviders(<EditorCanvas assignments={[initial]} />);
    const bar = getBar();

    dispatchPointer(bar, 'pointerdown', { clientX: 100, clientY: 100 });
    // x 방향 500px — pointerMoved=true, dmin != 0 → moved=true → applyMove.
    dispatchPointer(window, 'pointermove', { clientX: 600, clientY: 100 });
    dispatchPointer(window, 'pointerup', { clientX: 600, clientY: 100 });

    expect(screen.queryByRole('dialog')).toBeNull();
    const after = useEditorStore.getState().currentRows[0];
    expect(after?.start).toBeDefined();
    expect(after?.start).not.toBe(initial.start);
  });

  it('disabled=true 면 pointerDown 자체가 무시 (Dialog 안 열림)', () => {
    const rows = [row()];
    renderWithProviders(<EditorCanvas assignments={rows} disabled />);
    const bar = getBar();

    dispatchPointer(bar, 'pointerdown', { clientX: 100, clientY: 100 });
    dispatchPointer(window, 'pointerup', { clientX: 100, clientY: 100 });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('호버 카드에 issues 가 있으면 ⚠ 카운트 노출', () => {
    // r-1 은 berth=1, SND. berth 와 (f+e)/2 mid 위치를 어긋나게 두면 berth warning 발생.
    // useEditorIssueIndex 는 store.currentRows 기반이므로 store 에도 같은 데이터 주입.
    const bad = row({ berth: 2, f: 0, e: 200 });
    useEditorStore.setState({
      scenarioId: 'test',
      originalRows: [bad],
      currentRows: [bad],
      selectedRowId: null,
      history: [],
      historyIndex: -1,
    });
    renderWithProviders(<EditorCanvas assignments={[bad]} />);
    const bar = getBar();
    fireEvent.pointerEnter(bar, { clientX: 100, clientY: 100 });
    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText(/⚠/)).toBeInTheDocument();
  });
});
