// Plotly 는 jsdom 에서 canvas/SVG 측정이 깨져 테스트에 부담이 크다.
// 테스트 환경에서는 trace 개수만 노출하는 stub 으로 대체한다.
// 두 가지 import 경로를 alias 하므로 default + named (Plot) 둘 다 노출.
//
// 각 trace 마다 invisible button 을 렌더 — `data-testid="plotly-trace-{i}"`.
// 테스트에서 fireEvent.mouseEnter/Leave/Click 으로 props 의 onHover/onUnhover/onClick
// 을 시뮬레이션할 수 있다. customdata 첫 값을 받아 PlotMouseEvent.points[0].customdata
// 형태로 전달.

import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';

type Trace = { customdata?: unknown };

interface Props {
  data?: Trace[];
  layout?: unknown;
  style?: CSSProperties;
  useResizeHandler?: boolean;
  config?: unknown;
  onHover?: (e: unknown) => void;
  onUnhover?: (e: unknown) => void;
  onClick?: (e: unknown) => void;
}

function firstCustomdata(t: Trace): unknown {
  const cd = t.customdata;
  if (Array.isArray(cd)) return cd[0];
  return cd ?? null;
}

function makeEvent(cd: unknown, e: ReactMouseEvent): unknown {
  return {
    points: [{ customdata: cd }],
    event: { clientX: e.clientX, clientY: e.clientY },
  };
}

function PlotMock({ data, style, onHover, onUnhover, onClick }: Props) {
  const traces: Trace[] = Array.isArray(data) ? data : [];
  return (
    <div data-testid="plotly-mock" data-trace-count={traces.length} style={style}>
      [plot mock — {traces.length} traces]
      {traces.map((t, i) => {
        const cd = firstCustomdata(t);
        return (
          <button
            key={i}
            type="button"
            data-testid={`plotly-trace-${i}`}
            data-customdata={typeof cd === 'string' ? cd : ''}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            onMouseEnter={(e) => onHover?.(makeEvent(cd, e))}
            onMouseLeave={(e) => onUnhover?.(makeEvent(cd, e))}
            onClick={(e) => onClick?.(makeEvent(cd, e))}
          />
        );
      })}
    </div>
  );
}

export default PlotMock;
export const Plot = PlotMock;
