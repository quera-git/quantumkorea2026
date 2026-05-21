// GanttChart 의 Plotly hover/click 라우팅 검증.
// SplitTimeline.test.tsx 와 동일 패턴 — react-plotly mock 이 trace 마다 invisible button 을
// 만들어 onHover/onUnhover/onClick prop 을 시뮬레이션.

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ScheduleEntry } from '@/shared/types/schema';
import { renderWithProviders } from '@/test/renderWithProviders';

import { GanttChart } from './GanttChart';

function entry(over: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    vessel_id: 'S-1',
    length: 200,
    eta: 0,
    etb: 1,
    etd: 9,
    berth_position: 100,
    note: '',
    ...over,
  };
}

describe('GanttChart hover/click 라우팅', () => {
  it('스케줄 0건 → "스케줄 데이터가 없습니다"', () => {
    renderWithProviders(<GanttChart schedule={[]} />);
    expect(screen.getByText(/스케줄 데이터가 없습니다/)).toBeInTheDocument();
  });

  it('각 trace 의 customdata 에 vessel_id 가 들어간다', () => {
    renderWithProviders(
      <GanttChart schedule={[entry({ vessel_id: 'a' }), entry({ vessel_id: 'b' })]} />,
    );
    expect(screen.getByTestId('plotly-trace-0').getAttribute('data-customdata')).toBe('a');
    expect(screen.getByTestId('plotly-trace-1').getAttribute('data-customdata')).toBe('b');
  });

  it('trace mouseEnter → VesselHoverCard 등장', () => {
    renderWithProviders(<GanttChart schedule={[entry()]} />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByTestId('plotly-trace-0'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('S-1')).toBeInTheDocument();
  });

  it('trace mouseLeave → hover card 닫힘', () => {
    renderWithProviders(<GanttChart schedule={[entry()]} />);
    const trace = screen.getByTestId('plotly-trace-0');
    fireEvent.mouseEnter(trace);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(trace);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('trace click → VesselDetailDialog 등장', () => {
    renderWithProviders(<GanttChart schedule={[entry()]} />);
    fireEvent.click(screen.getByTestId('plotly-trace-0'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toContain('S-1');
  });
});
