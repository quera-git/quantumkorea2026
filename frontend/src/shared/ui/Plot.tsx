// 차트 단일 진입점.
// react-plotly.js 의 default export 는 plotly.js (full ~4MB) 을 끌어와 번들이 폭발한다.
// factory 로 가벼운 plotly.js-basic-dist-min (~1MB, scatter/bar/pie/line 등 기본만) 를
// 주입해 번들을 줄였다. 우리 차트는 Gantt 류 scatter + shape 만 쓰므로 충분.

// @ts-expect-error -- plotly.js-basic-dist-min 은 타입 미제공. 런타임 객체만 사용.
import Plotly from 'plotly.js-basic-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

export const Plot = createPlotlyComponent(Plotly);
