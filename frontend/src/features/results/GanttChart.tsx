import { useTheme } from '@emotion/react';
import type { Layout, PlotData } from 'plotly.js';

import { Plot } from '@/shared/ui/Plot';
import type { ScheduleEntry } from '@/shared/types/schema';

interface Props {
  schedule: ScheduleEntry[];
  /** subplot 으로 묶을 때 plot 높이를 외부에서 조절. 기본 480. */
  height?: number;
  /** y축 범위. 미지정 시 [0, 1500]. */
  yRange?: [number, number];
  /** x축 범위. 미지정 시 데이터 자동. */
  xRange?: [number, number];
  /** 차트 제목. */
  title?: string;
}

/**
 * 선석 배정 결과 간트.
 * - X축: 시간(시간 단위, eta_int 와 동일 스케일)
 * - Y축: 접안 위치(m)
 * - 각 막대는 [etb, etd] 구간을 길이 비례 두께로 표시.
 */
export function GanttChart({ schedule, height = 480, yRange, xRange, title }: Props) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : '#eef0f6';
  const plotBg = isDark ? 'rgba(255,255,255,0.02)' : '#fafbfd';
  const tickColor = isDark ? theme.color.textMuted : '#475569';

  if (schedule.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: theme.color.textSubtle,
          fontSize: 13,
        }}
      >
        스케줄 데이터가 없습니다.
      </div>
    );
  }

  const data: Partial<PlotData>[] = schedule.map((entry) => ({
    x: [entry.etb, entry.etd],
    y: [entry.berth_position, entry.berth_position],
    mode: 'lines',
    line: { width: Math.max(8, entry.length / 20) },
    name: entry.vessel_id,
    hovertext: `${entry.vessel_id} (L=${entry.length}m) @ ${entry.berth_position}m${entry.note ? ` · ${entry.note}` : ''}`,
    hoverinfo: 'x+text',
    type: 'scatter',
  }));

  const layout: Partial<Layout> = {
    title: title ? { text: title, font: { size: 14, color: theme.color.text } } : undefined,
    xaxis: {
      title: { text: '시간 (h)' },
      range: xRange,
      gridcolor: gridColor,
      tickcolor: tickColor,
      color: tickColor,
    },
    yaxis: {
      title: { text: '접안 위치 (m)' },
      range: yRange ?? [0, 1500],
      gridcolor: gridColor,
      tickcolor: tickColor,
      color: tickColor,
    },
    height,
    showlegend: true,
    legend: { font: { color: theme.color.text } },
    margin: { l: 60, r: 20, t: title ? 40 : 20, b: 40 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: plotBg,
    font: { family: 'Pretendard Variable, system-ui, sans-serif', color: theme.color.text },
  };

  return (
    <Plot
      data={data}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  );
}
