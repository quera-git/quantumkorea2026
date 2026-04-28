import Plot from 'react-plotly.js';
import type { ScheduleEntry } from '../types/schema';

interface Props {
  schedule: ScheduleEntry[];
}

// 선석 배정 결과를 간트 차트로 표시 (X축: 시간(시간 단위), Y축: 접안 위치(m)).
export default function GanttChart({ schedule }: Props) {
  if (schedule.length === 0) {
    return <p>스케줄 데이터가 없습니다.</p>;
  }

  const data = schedule.map((entry) => ({
    x: [entry.etb, entry.etd],
    y: [entry.berth_position, entry.berth_position],
    mode: 'lines' as const,
    line: { width: Math.max(8, entry.length / 20) },
    name: entry.vessel_id,
    hovertext: `${entry.vessel_id} (L=${entry.length}m) @ ${entry.berth_position}m, ${entry.note}`,
    type: 'scatter' as const,
  }));

  return (
    <Plot
      data={data}
      layout={{
        title: { text: '선석 배정 간트 차트' },
        xaxis: { title: { text: '시간 (h)' } },
        yaxis: { title: { text: '접안 위치 (m)' }, range: [0, 1500] },
        height: 500,
        showlegend: true,
      }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  );
}
