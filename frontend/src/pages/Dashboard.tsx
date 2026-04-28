import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import GanttChart from '../components/GanttChart';
import type { OptimizeResult } from '../types/schema';

export default function Dashboard() {
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get('/health')
      .then(() => setHealthError(null))
      .catch((e) => setHealthError(`백엔드 연결 실패: ${e.message}`));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>항만 물류 양자 최적화</h1>
      {healthError && <p style={{ color: 'crimson' }}>{healthError}</p>}
      {result ? (
        <GanttChart schedule={result.schedule} />
      ) : (
        <p>최적화 작업을 제출해주세요. (UI는 다음 단계에서 추가)</p>
      )}
      {/* setResult는 향후 작업 제출 폼에서 사용 예정 */}
      <button
        type="button"
        style={{ display: 'none' }}
        onClick={() => setResult(null)}
      />
    </div>
  );
}
