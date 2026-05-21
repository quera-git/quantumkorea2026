// 선석 배정 결과 간트 (1D ScheduleEntry).
// Phase 9 — Plotly hover/click 을 우리 VesselHoverCard/VesselDetailDialog 로 라우팅.
// reference time 정보가 없어 dialog 의 ISO 시간은 "-" 로 표시되지만, voyage/길이/B.P. 등
// 핵심 메타는 보임.

import { useTheme } from '@emotion/react';
import { useMemo, useState } from 'react';
import type { Layout, PlotData, PlotMouseEvent } from 'plotly.js';

import { Plot } from '@/shared/ui/Plot';
import { TERMINAL_LAYOUT, type Terminal } from '@/shared/domain/constants';
import { scheduleEntryToAssignment } from '@/shared/domain/vesselAdapters';
import type { ScheduleEntry } from '@/shared/types/schema';
import { VesselDetailDialog } from '@/shared/ui/VesselDetailDialog';
import { VesselHoverCard } from '@/shared/ui/VesselHoverCard';

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
  /** y라벨 step 기준 터미널. 미지정 시 SND(=300m) step. */
  terminal?: Terminal;
}

/**
 * 선석 배정 결과 간트.
 * - X축: 시간(시간 단위, eta_int 와 동일 스케일)
 * - Y축: 접안 위치(m)
 * - 각 막대는 [etb, etd] 구간을 길이 비례 두께로 표시.
 * - trace 호버 → 카드 (vessel/길이/B.P./hour offset). 클릭 → dialog.
 */
export function GanttChart({ schedule, height = 480, yRange, xRange, title, terminal }: Props) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : '#eef0f6';
  const plotBg = isDark ? 'rgba(255,255,255,0.02)' : '#fafbfd';
  const tickColor = isDark ? theme.color.textMuted : '#475569';

  const [hover, setHover] = useState<{ vesselId: string; x: number; y: number } | null>(null);
  const [detailVesselId, setDetailVesselId] = useState<string | null>(null);

  // schedule entry 의 vessel_id → Assignment-like (메모).
  const assignmentByVesselId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof scheduleEntryToAssignment>>();
    schedule.forEach((s, i) => {
      m.set(s.vessel_id, scheduleEntryToAssignment(s, i, null));
    });
    return m;
  }, [schedule]);

  const hoverAssignment = hover ? (assignmentByVesselId.get(hover.vesselId) ?? null) : null;
  const detailAssignment = detailVesselId
    ? (assignmentByVesselId.get(detailVesselId) ?? null)
    : null;

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
    hoverinfo: 'none',
    customdata: [entry.vessel_id, entry.vessel_id] as unknown as PlotData['customdata'],
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
      // 라벨 = 선석 경계 (SND 300m / GAM 350m). terminal 미지정 시 SND.
      dtick: terminal ? TERMINAL_LAYOUT[terminal].step : TERMINAL_LAYOUT.SND.step,
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

  function vesselIdFromEvent(ev: Readonly<PlotMouseEvent>): string | null {
    const p = ev.points?.[0];
    if (!p) return null;
    const cd = (p as { customdata?: unknown }).customdata;
    return typeof cd === 'string' ? cd : null;
  }
  function clientXYFromEvent(ev: Readonly<PlotMouseEvent>): { x: number; y: number } | null {
    const ne = ev.event as MouseEvent | undefined;
    if (!ne || typeof ne.clientX !== 'number' || typeof ne.clientY !== 'number') return null;
    return { x: ne.clientX, y: ne.clientY };
  }

  return (
    <>
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
        useResizeHandler
        onHover={(ev) => {
          const vid = vesselIdFromEvent(ev);
          const xy = clientXYFromEvent(ev);
          if (!vid || !xy) return;
          setHover({ vesselId: vid, x: xy.x, y: xy.y });
        }}
        onUnhover={() => setHover(null)}
        onClick={(ev) => {
          const vid = vesselIdFromEvent(ev);
          if (!vid) return;
          setHover(null);
          setDetailVesselId(vid);
        }}
      />
      {hover && hoverAssignment && (
        <VesselHoverCard assignment={hoverAssignment} anchorX={hover.x} anchorY={hover.y} />
      )}
      <VesselDetailDialog
        open={detailVesselId !== null}
        assignment={detailAssignment}
        onClose={() => setDetailVesselId(null)}
      />
    </>
  );
}
