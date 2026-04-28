import Plot from 'react-plotly.js';
import type { ScheduleEntry } from '../types/schema';

interface Props {
  schedule: ScheduleEntry[];
}

// 선석 배정 결과를 간트 차트로 표시.
export default function GanttChart({ schedule }: Props) {
  if (schedule.length === 0) {
    return <p>스케줄 데이터가 없습니다.</p>;
  }

  const data = schedule.map((entry) => ({
    x: [entry.start_time, entry.end_time],
    y: [entry.berth_id, entry.berth_id],
    mode: 'lines' as const,
    line: { width: 20 },
    name: entry.vessel_id,
    hovertext: `${entry.vessel_id} @ ${entry.berth_id}`,
    type: 'scatter' as const,
  }));

  return (
    <Plot
      data={data}
      layout={{
        title: { text: '선석 배정 간트 차트' },
        xaxis: { type: 'date', title: { text: '시간' } },
        yaxis: { title: { text: '선석' } },
        height: 500,
        showlegend: true,
      }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  );
}
