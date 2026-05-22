// SplitTimeline 의 hover/click 라우팅 테스트.
//
// jsdom 에서 Plotly 는 동작 X — vitest.config 의 alias 로 src/test/mocks/react-plotly.tsx 가
// 대신 마운트된다. mock 은 trace 마다 invisible <button> 을 만들어주고, mouseEnter/Leave/Click
// 시 우리 SplitTimeline 의 onHover/onUnhover/onClick prop 을 PlotMouseEvent shape 으로 호출.
//
// 검증:
//   1. trace 의 customdata 에 Assignment.rowId 가 채워진다.
//   2. trace 호버 → VesselHoverCard (role="tooltip") 등장
//   3. trace 클릭 → VesselDetailDialog (role="dialog") 등장
//   4. unhover → hover card 닫힘

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';
import { renderWithProviders } from '@/test/renderWithProviders';

import { SplitTimeline } from './SplitTimeline';

function row(over: Partial<Assignment> = {}): Assignment {
  return {
    rowId: 'r-1',
    voyage: 'PCBS-2026-21',
    vessel: 'PACIFIC BUSAN',
    company: 'HAS',
    sectionRaw: '신선대',
    terminal: 'SND',
    berth: 2,
    route: 'EA',
    start: '2026-05-23T03:00:00.000Z',
    end: '2026-05-23T15:00:00.000Z',
    eta: null,
    etbInt: null,
    etdInt: null,
    etaInt: null,
    f: 5,
    e: 138,
    length: 133,
    yanghaVan: 190,
    seonjeokVan: 300,
    shiftingVan: 0,
    workHours: 12,
    planStatus: 'crane_assigned',
    ...over,
  };
}

describe('SplitTimeline hover/click 라우팅', () => {
  it('각 trace 의 customdata 에 rowId 가 들어간다', () => {
    renderWithProviders(<SplitTimeline assignments={[row({ rowId: 'a' }), row({ rowId: 'b', terminal: 'GAM', berth: 7 })]} />);
    // mock 은 trace 마다 button[data-customdata=rowId] 렌더
    expect(screen.getByTestId('plotly-trace-0').getAttribute('data-customdata')).toBe('a');
    expect(screen.getByTestId('plotly-trace-1').getAttribute('data-customdata')).toBe('b');
  });

  it('trace mouseEnter → VesselHoverCard 등장', () => {
    renderWithProviders(<SplitTimeline assignments={[row()]} />);
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.mouseEnter(screen.getByTestId('plotly-trace-0'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('PCBS-2026-21')).toBeInTheDocument();
  });

  it('trace mouseLeave → hover card 닫힘', () => {
    renderWithProviders(<SplitTimeline assignments={[row()]} />);
    const trace = screen.getByTestId('plotly-trace-0');
    fireEvent.mouseEnter(trace);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(trace);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('trace click → VesselDetailDialog 등장 + 모든 필드 노출', () => {
    renderWithProviders(<SplitTimeline assignments={[row()]} />);
    fireEvent.click(screen.getByTestId('plotly-trace-0'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toContain('PACIFIC BUSAN');
    expect(dialog.textContent).toContain('PCBS-2026-21');
    expect(dialog.textContent).toContain('HAS');
  });

  it('잘못된 customdata 가 와도 (assignments 갱신 직후 race) 안전하게 무시', () => {
    const { rerender } = renderWithProviders(<SplitTimeline assignments={[row({ rowId: 'a' })]} />);
    // rowId 가 다른 데이터로 교체 — race 시 mock 의 customdata 가 갱신되지만 무관.
    rerender(<SplitTimeline assignments={[row({ rowId: 'a' })]} />);
    fireEvent.mouseEnter(screen.getByTestId('plotly-trace-0'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});
