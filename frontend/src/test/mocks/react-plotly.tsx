// Plotly 는 jsdom 에서 canvas/SVG 측정이 깨져 테스트에 부담이 크다.
// 테스트 환경에서는 trace 개수만 노출하는 stub 으로 대체한다.

import type { CSSProperties } from 'react';

interface Props {
  data?: unknown[];
  layout?: unknown;
  style?: CSSProperties;
  useResizeHandler?: boolean;
  config?: unknown;
}

export default function PlotMock({ data, style }: Props) {
  const count = Array.isArray(data) ? data.length : 0;
  return (
    <div data-testid="plotly-mock" data-trace-count={count} style={style}>
      [plot mock — {count} traces]
    </div>
  );
}
