import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import GanttChart from '../components/GanttChart';
import type {
  BPTRecord, JobAccepted, OptimizeResult, SolverName,
} from '../types/schema';

// 폴링 간격(ms) — 솔버는 분 단위 작업이라 5초면 충분.
const POLL_INTERVAL_MS = 5000;

// 데모용 샘플 BPT (3척, 12시간 freeze 윈도우 내). DB BPT 없을 때의 fallback.
const SAMPLE_BPT: BPTRecord[] = [
  { vessel_id: 'D-1', length: 140, eta_int: 0, etb_int: 0, etd_int: 8,
    berth_position: 100, yangha_van: 30, seonjeok_van: 30 },
  { vessel_id: 'D-2', length: 160, eta_int: 1, etb_int: 1, etd_int: 10,
    berth_position: 300, yangha_van: 40, seonjeok_van: 40 },
  { vessel_id: 'D-3', length: 180, eta_int: 3, etb_int: 3, etd_int: 11,
    berth_position: 600, yangha_van: 50, seonjeok_van: 50 },
];

type Phase = 'idle' | 'submitting' | 'running' | 'done' | 'error';
type BPTSource = 'sample' | 'db';

export default function Dashboard() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [solver, setSolver] = useState<SolverName>('gurobi');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // BPT 데이터 소스 (샘플 3척 / DB 적재분) + 사용 척수 제한
  const [source, setSource] = useState<BPTSource>('db');
  const [dbBpt, setDbBpt] = useState<BPTRecord[]>([]);
  const [limit, setLimit] = useState<number>(10);
  const [bptError, setBptError] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);

  // 헬스체크 + DB BPT 카운트 (마운트 시 1회)
  useEffect(() => {
    apiClient
      .get('/health')
      .then(() => setHealthError(null))
      .catch((e) => setHealthError(`백엔드 연결 실패: ${e.message}`));
    apiClient
      .get<BPTRecord[]>('/bpt/')
      .then(({ data }) => {
        setDbBpt(data);
        setBptError(null);
      })
      .catch((e) => setBptError(`BPT 조회 실패: ${e.message}`));
  }, []);

  const refreshCrawler = async () => {
    setBptError(null);
    try {
      await apiClient.post('/crawler/refresh');
      const { data } = await apiClient.get<BPTRecord[]>('/bpt/');
      setDbBpt(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBptError(`크롤러 실패: ${msg}`);
    }
  };

  const effectiveRecords: BPTRecord[] =
    source === 'sample' ? SAMPLE_BPT : dbBpt.slice(0, limit);

  // running 동안 1초마다 elapsed 갱신 + 5초마다 결과 폴링
  useEffect(() => {
    if (phase !== 'running' || !jobId) return;

    const tick = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }
    }, 1000);

    const poll = setInterval(async () => {
      try {
        const { data } = await apiClient.get<OptimizeResult>(`/results/${jobId}`);
        if (data.status === 'succeeded') {
          setResult(data);
          setPhase('done');
        } else if (data.status === 'failed') {
          setError(data.error_message ?? '작업 실패 (사유 미지정)');
          setPhase('error');
        }
        // running 이면 계속 폴링
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`폴링 실패: ${msg}`);
        setPhase('error');
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [phase, jobId]);

  const handleSubmit = async () => {
    if (effectiveRecords.length === 0) {
      setError('BPT 데이터가 비어 있습니다. 크롤러 갱신 후 다시 시도하세요.');
      setPhase('error');
      return;
    }
    setPhase('submitting');
    setError(null);
    setResult(null);
    setElapsed(0);
    try {
      const { data } = await apiClient.post<JobAccepted>('/jobs/', {
        job_id: `${solver}-${Date.now()}`,
        bpt_records: effectiveRecords,
        solver,
        planning_start_time: 0,
      });
      setJobId(data.job_id);
      startedAtRef.current = Date.now();
      setPhase('running');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`제출 실패: ${msg}`);
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setJobId(null);
    setResult(null);
    setElapsed(0);
    setError(null);
    startedAtRef.current = null;
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1200 }}>
      <h1>항만 물류 양자 최적화</h1>

      {healthError && (
        <p style={{ color: 'crimson' }}>⚠️ {healthError}</p>
      )}

      {/* --- 제출 폼 (idle / submitting) --- */}
      {(phase === 'idle' || phase === 'submitting') && (
        <section style={card}>
          <h2>새 작업 제출</h2>

          {/* BPT 소스 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ marginRight: 8, fontWeight: 600 }}>BPT 데이터:</label>
            <label style={{ marginRight: 16 }}>
              <input
                type="radio"
                name="source"
                checked={source === 'db'}
                onChange={() => setSource('db')}
                disabled={phase === 'submitting'}
              />
              {' '}DB 적재분 ({dbBpt.length}척)
            </label>
            <label style={{ marginRight: 16 }}>
              <input
                type="radio"
                name="source"
                checked={source === 'sample'}
                onChange={() => setSource('sample')}
                disabled={phase === 'submitting'}
              />
              {' '}샘플 3척
            </label>
            <button
              type="button"
              onClick={refreshCrawler}
              disabled={phase === 'submitting'}
              style={{ ...btnSecondary, marginLeft: 8 }}
            >
              크롤러 갱신
            </button>
          </div>

          {source === 'db' && dbBpt.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ marginRight: 8, fontWeight: 600 }}>
                사용 척수: {limit} / {dbBpt.length}
              </label>
              <input
                type="range"
                min={1}
                max={dbBpt.length}
                value={Math.min(limit, dbBpt.length)}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                disabled={phase === 'submitting'}
                style={{ width: 240, verticalAlign: 'middle' }}
              />
              <span style={{ marginLeft: 12, color: '#666', fontSize: 13 }}>
                ※ Gurobi 는 척수가 많아질수록 분 단위로 느려집니다 (Rolling Horizon)
              </span>
            </div>
          )}

          {bptError && <p style={{ color: 'crimson' }}>⚠️ {bptError}</p>}

          {/* 솔버 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ marginRight: 8, fontWeight: 600 }}>솔버:</label>
            {(['gurobi', 'cqm', 'hybrid'] as const).map((s) => (
              <label key={s} style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  name="solver"
                  value={s}
                  checked={solver === s}
                  onChange={() => setSolver(s)}
                  disabled={phase === 'submitting'}
                />
                {' '}{s}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={phase === 'submitting' || effectiveRecords.length === 0}
            style={btnPrimary}
          >
            {phase === 'submitting'
              ? '제출 중...'
              : `최적화 실행 (${effectiveRecords.length}척, ${solver})`}
          </button>
        </section>
      )}

      {/* --- 실행 중 --- */}
      {phase === 'running' && (
        <section style={card}>
          <h2>⏳ 최적화 실행 중</h2>
          <p>job_id: <code>{jobId}</code></p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>
            경과 시간: {elapsed.toFixed(1)}s
          </p>
          <p style={{ color: '#666' }}>
            {POLL_INTERVAL_MS / 1000}초마다 백엔드에 결과를 확인합니다.
            솔버에 따라 분 단위가 소요될 수 있습니다.
          </p>
        </section>
      )}

      {/* --- 완료 --- */}
      {phase === 'done' && result && (
        <section style={card}>
          <h2>✅ 최적화 완료</h2>
          <p>
            <strong>솔버:</strong> {solver} {' | '}
            <strong>목적함수:</strong> {result.objective_value?.toFixed(2) ?? '-'} {' | '}
            <strong>총 소요:</strong> {result.elapsed_seconds?.toFixed(2) ?? '-'}s {' | '}
            <strong>스케줄:</strong> {result.schedule.length}척
          </p>
          <button type="button" onClick={handleReset} style={btnSecondary}>
            새 작업
          </button>
          <div style={{ marginTop: 16 }}>
            <GanttChart schedule={result.schedule} />
          </div>
        </section>
      )}

      {/* --- 에러 --- */}
      {phase === 'error' && (
        <section style={{ ...card, borderColor: 'crimson' }}>
          <h2 style={{ color: 'crimson' }}>❌ 작업 실패</h2>
          <p>{error}</p>
          <button type="button" onClick={handleReset} style={btnSecondary}>
            다시 시도
          </button>
        </section>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 16,
  marginTop: 16,
  background: '#fafafa',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 16,
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 14,
  background: '#f3f4f6',
  color: '#111',
  border: '1px solid #ddd',
  borderRadius: 4,
  cursor: 'pointer',
};
