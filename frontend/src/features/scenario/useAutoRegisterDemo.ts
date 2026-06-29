// 부스 데모 자동 등록 — 페이지 첫 진입 시 frontend/public/demo/ 의 시나리오들을
// 자동으로 uploadedScenarioStore 에 등록한다. 두 번째 방문부터는 localStorage 캐시 사용.
//
// 3 시나리오 × 5 결과 = 15 시나리오 등록:
//   #1 입력 / CQM / Hybrid / Gurobi / 운영자
//   #2 입력 / CQM / Hybrid / Gurobi / 운영자
//   #3 입력 / CQM / Hybrid / Gurobi / 운영자
//
// FourWayCompare 컴포넌트가 이 시나리오들을 id 로 lookup 해서 4-way 비교 표시.

import { useEffect, useRef } from 'react';

import { useUploadedScenarioStore } from '@/features/upload/uploadedScenarioStore';
import { ScenarioPayloadSchema } from '@/shared/domain/types';

interface DemoFile {
  id: string;
  file: string;
  label: string;
}

const DEMO_FILES: DemoFile[] = [
  // 시나리오 #1 (BPT_Result, 62척, 일반 운영)
  { id: 'scenario-1-input', file: 'scenario-1-input.payload.json', label: '#1 입력 — BPT_Result (62척, 일반 운영)' },
  { id: 'scenario-1-cqm', file: 'scenario-1-cqm.payload.json', label: '#1 CQM 결과' },
  { id: 'scenario-1-hybrid', file: 'scenario-1-hybrid.payload.json', label: '#1 Hybrid 결과' },
  { id: 'scenario-1-gurobi', file: 'scenario-1-gurobi.payload.json', label: '#1 Gurobi 결과' },
  { id: 'scenario-1-operator', file: 'scenario-1-operator.payload.json', label: '#1 운영자 결과' },

  // 시나리오 #2 (Before 0313 14:30, 58척, 낮시간 혼잡)
  { id: 'scenario-2-input', file: 'scenario-2-input.payload.json', label: '#2 입력 — Before 0313 14:30 (58척, 낮시간 혼잡)' },
  { id: 'scenario-2-cqm', file: 'scenario-2-cqm.payload.json', label: '#2 CQM 결과' },
  { id: 'scenario-2-hybrid', file: 'scenario-2-hybrid.payload.json', label: '#2 Hybrid 결과' },
  { id: 'scenario-2-gurobi', file: 'scenario-2-gurobi.payload.json', label: '#2 Gurobi 결과' },
  { id: 'scenario-2-operator', file: 'scenario-2-operator.payload.json', label: '#2 운영자 결과 (After 16:10)' },

  // 시나리오 #3 (Before 0316 08:00, 58척, 크레인 부족)
  { id: 'scenario-3-input', file: 'scenario-3-input.payload.json', label: '#3 입력 — Before 0316 08:00 (58척, 크레인 부족)' },
  { id: 'scenario-3-cqm', file: 'scenario-3-cqm.payload.json', label: '#3 CQM 결과' },
  { id: 'scenario-3-hybrid', file: 'scenario-3-hybrid.payload.json', label: '#3 Hybrid 결과' },
  { id: 'scenario-3-gurobi', file: 'scenario-3-gurobi.payload.json', label: '#3 Gurobi 결과' },
  { id: 'scenario-3-operator', file: 'scenario-3-operator.payload.json', label: '#3 운영자 결과 (After 10:06)' },
];

/**
 * 데모 시나리오 자동 등록 hook.
 * - uploadedScenarios 가 비어있을 때만 동작.
 * - StrictMode 의 double-mount 대응 — useRef 로 ran 플래그.
 */
export function useAutoRegisterDemo(): void {
  const hasScenarios = useUploadedScenarioStore((s) => s.scenarios.length > 0);
  const add = useUploadedScenarioStore((s) => s.add);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (hasScenarios) return;
    ranRef.current = true;

    (async () => {
      for (const demo of DEMO_FILES) {
        try {
          const res = await fetch(`/demo/${demo.file}`);
          if (!res.ok) {
            console.warn(`[demo] fetch fail: ${demo.file} (${res.status})`);
            continue;
          }
          const raw = await res.json();
          const payload = ScenarioPayloadSchema.parse(raw);
          add({
            id: demo.id,
            label: demo.label,
            sourceFile: demo.file,
            rows: payload.rows,
            format: 'scenario-payload',
            droppedInConversion: 0,
          });
        } catch (e) {
          console.error(`[demo] register fail: ${demo.file}`, e);
        }
      }
    })();
  }, [hasScenarios, add]);
}
