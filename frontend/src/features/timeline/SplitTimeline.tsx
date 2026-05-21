import { useTheme } from '@emotion/react';
import { useMemo } from 'react';
import type { Annotations, Layout, PlotData, Shape } from 'plotly.js';

import { Plot } from '@/shared/ui/Plot';
import { TERMINAL_LAYOUT, type Terminal } from '@/shared/domain/constants';
import { planStatusVisual } from '@/shared/domain/statusColors';
import type { Assignment } from '@/shared/domain/types';

import { useColorBy, type ColorByMode } from './colorBy';

interface Props {
  assignments: Assignment[];
  /** 차트 전체 높이(px). 기본 720. SND/GAM 두 subplot 이 그 안에 분할. */
  height?: number;
  /** 시작 시각 클램프 (옵션). 미지정 시 데이터 min/max 자동. */
  xRange?: [string, string];
}

const TERMINAL_ORDER: Terminal[] = ['SND', 'GAM'];

// 같은 voyage 는 같은 색을 가지도록 해시 기반 팔레트.
const PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
];

function colorForVoyage(voyage: string): string {
  let h = 0;
  for (let i = 0; i < voyage.length; i += 1) {
    h = (h * 31 + voyage.charCodeAt(i)) % 1_000_000;
  }
  return PALETTE[h % PALETTE.length] ?? PALETTE[0]!;
}

function rgbaWithAlpha(hex: string, alpha: number): string {
  const m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * SND(상)/GAM(하) 분할 read-only 타임라인.
 *
 * - 각 행은 (start~end) × (f~e) 의 사각형으로 표시 (선체 점유 구역 직관적).
 * - 같은 voyage 는 같은 색.
 * - 선석 경계는 각 subplot 안 점선.
 * - 클릭/드래그 없음 (Phase 4 에서 별도 editor 컴포넌트로 추가).
 */
export function SplitTimeline({ assignments, height = 720, xRange }: Props) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : '#eef0f6';
  const plotBg = isDark ? 'rgba(255,255,255,0.02)' : '#fafbfd';
  const tickColor = isDark ? theme.color.textMuted : '#475569';
  const colorBy = useColorBy((s) => s.mode);

  const { traces, shapes, annotations, computedXRange } = useMemo(
    () => buildFigure(assignments, xRange, colorBy),
    [assignments, xRange, colorBy],
  );

  const layout: Partial<Layout> = {
    height,
    margin: { l: 70, r: 30, t: 30, b: 50 },
    showlegend: false,
    hovermode: 'closest',
    paper_bgcolor: 'transparent',
    plot_bgcolor: plotBg,
    grid: { rows: 2, columns: 1, pattern: 'independent' },

    // SND (상단)
    xaxis: {
      type: 'date',
      domain: [0, 1],
      anchor: 'y',
      range: computedXRange,
      gridcolor: gridColor,
      tickcolor: tickColor,
      color: tickColor,
      showgrid: true,
      showticklabels: false,
    },
    yaxis: {
      domain: [0.52, 1],
      range: [0, TERMINAL_LAYOUT.SND.yMax],
      // 라벨 = 선석 경계 (0, 300, 600, 900, 1200, 1500)
      dtick: TERMINAL_LAYOUT.SND.step,
      title: { text: 'SND (m)', standoff: 8 },
      gridcolor: gridColor,
      tickcolor: tickColor,
      color: tickColor,
      zeroline: false,
    },

    // GAM (하단)
    xaxis2: {
      type: 'date',
      domain: [0, 1],
      anchor: 'y2',
      range: computedXRange,
      matches: 'x',
      gridcolor: gridColor,
      tickcolor: tickColor,
      color: tickColor,
      showgrid: true,
    },
    yaxis2: {
      domain: [0, 0.48],
      range: [0, TERMINAL_LAYOUT.GAM.yMax],
      // 라벨 = 선석 경계 (0, 350, 700, 1050, 1400)
      dtick: TERMINAL_LAYOUT.GAM.step,
      title: { text: 'GAM (m)', standoff: 8 },
      gridcolor: gridColor,
      tickcolor: tickColor,
      color: tickColor,
      zeroline: false,
    },

    shapes,
    annotations,
    font: { family: 'Pretendard Variable, system-ui, sans-serif', color: theme.color.text },
  };

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  );
}

interface FigureBuild {
  traces: Partial<PlotData>[];
  shapes: Partial<Shape>[];
  annotations: Partial<Annotations>[];
  computedXRange: [string, string] | undefined;
}

function buildFigure(
  assignments: Assignment[],
  xRangeProp: [string, string] | undefined,
  colorBy: ColorByMode,
): FigureBuild {
  const traces: Partial<PlotData>[] = [];
  const shapes: Partial<Shape>[] = [];
  const annotations: FigureBuild['annotations'] = [];

  let xMinMs = Number.POSITIVE_INFINITY;
  let xMaxMs = Number.NEGATIVE_INFINITY;

  for (const a of assignments) {
    if (a.terminal !== 'SND' && a.terminal !== 'GAM') continue;
    if (!a.start || !a.end) continue;
    if (a.f == null || a.e == null) continue;

    const start = a.start;
    const end = a.end;
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;

    xMinMs = Math.min(xMinMs, startMs);
    xMaxMs = Math.max(xMaxMs, endMs);

    const yLo = Math.min(a.f, a.e);
    const yHi = Math.max(a.f, a.e);
    const axisSuffix = a.terminal === 'SND' ? '' : '2';
    const xAxisRef = `x${axisSuffix}` as 'x' | 'x2';
    const yAxisRef = `y${axisSuffix}` as 'y' | 'y2';

    let fillColor: string;
    let strokeColor: string;
    if (colorBy === 'status') {
      const v = planStatusVisual(a.planStatus);
      fillColor = v.fill;
      strokeColor = v.stroke;
    } else {
      const voyageColor = colorForVoyage(a.voyage);
      fillColor = rgbaWithAlpha(voyageColor, 0.55);
      strokeColor = voyageColor;
    }

    const statusLabel = a.planStatus ? planStatusVisual(a.planStatus).label : '미지정';

    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [start, end, end, start, start],
      y: [yLo, yLo, yHi, yHi, yLo],
      xaxis: xAxisRef,
      yaxis: yAxisRef,
      fill: 'toself',
      fillcolor: fillColor,
      line: { color: strokeColor, width: 1.2 },
      hoverinfo: 'text',
      hovertext:
        `${a.voyage} · ${a.vessel ?? ''}` +
        `<br>terminal=${a.terminal} berth=${a.berth} (${a.company ?? ''})` +
        `<br>상태: ${statusLabel}` +
        `<br>start=${start.replace('T', ' ').slice(0, 16)}` +
        `<br>end=${end.replace('T', ' ').slice(0, 16)}` +
        `<br>f=${a.f}m e=${a.e}m length=${a.length ?? '-'}m`,
      showlegend: false,
    });

    // 가운데 voyage 라벨 (작은 텍스트 트레이스 1개로 묶지 않고 annotation 사용)
    annotations.push({
      x: new Date((startMs + endMs) / 2).toISOString(),
      y: (yLo + yHi) / 2,
      xref: xAxisRef,
      yref: yAxisRef,
      text: a.voyage,
      showarrow: false,
      font: { size: 9, color: '#0f172a' },
      bgcolor: 'rgba(255,255,255,0.6)',
      borderpad: 1,
    });
  }

  // 선석 구분선(점선) — 각 terminal layout.step 간격마다.
  for (const t of TERMINAL_ORDER) {
    const layout = TERMINAL_LAYOUT[t];
    const xAxisRef = t === 'SND' ? 'x' : 'x2';
    const yAxisRef = t === 'SND' ? 'y' : 'y2';
    for (let i = 1; i < layout.berths.length; i += 1) {
      const y = i * layout.step;
      shapes.push({
        type: 'line',
        xref: `${xAxisRef} domain` as Shape['xref'],
        yref: yAxisRef,
        x0: 0,
        x1: 1,
        y0: y,
        y1: y,
        line: { color: '#cdd2e0', width: 1, dash: 'dot' },
      });
    }
    // berth 라벨
    layout.berths.forEach((b, idx) => {
      const yMid = (idx + 0.5) * layout.step;
      annotations.push({
        xref: `${xAxisRef} domain` as 'x domain',
        yref: yAxisRef,
        x: -0.012,
        y: yMid,
        xanchor: 'right',
        yanchor: 'middle',
        text: `B${b}`,
        showarrow: false,
        font: { size: 11, color: '#5b6478', family: 'monospace' },
      });
    });
  }

  const computedXRange =
    xRangeProp ??
    (Number.isFinite(xMinMs) && Number.isFinite(xMaxMs)
      ? ([new Date(xMinMs).toISOString(), new Date(xMaxMs).toISOString()] as [string, string])
      : undefined);

  return { traces, shapes, annotations, computedXRange };
}
