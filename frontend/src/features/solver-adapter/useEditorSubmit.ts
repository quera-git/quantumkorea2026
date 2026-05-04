// 편집본 → 솔버 제출 → 폴링 → 결과 stitch → editor.store.lastResult 저장.
//
// 흐름:
//   1) adapterCheck(currentRows) → blocking 있으면 거부
//   2) buildOptimizeRequest → POST /jobs/ (useSubmitJob)
//   3) job_id 받으면 activeJobId 로 보관, usePollingJobResult 가 5초 폴링
//   4) succeeded 되면 stitchResult 로 풍부 도메인 복원 → setResult
//   5) failed 되면 toast + reset

import { useCallback, useEffect, useState } from 'react';

import { useEditorStore } from '@/features/editor/editor.store';
import {
  usePollingJobResult,
  useSubmitJob,
} from '@/features/jobs/jobs.queries';
import { extractErrorMessage } from '@/shared/api/client';
import type { Assignment } from '@/shared/domain/types';
import { useToast } from '@/shared/ui/Toast';
import type { SolverName } from '@/shared/types/schema';

import {
  adapterCheck,
  buildOptimizeRequest,
  stitchResult,
  type AdapterCheck,
} from './adapter';

export interface SubmitState {
  /** 활성 job_id (제출 후 진행 중). 없으면 null. */
  activeJobId: string | null;
  /** 가장 최근 어댑터 검증 결과. */
  check: AdapterCheck | null;
  /** 활성 job 의 폴링 status. */
  pollingStatus: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
  pollingError: string | null;
}

export function useEditorSubmit() {
  const currentRows = useEditorStore((s) => s.currentRows);
  const originalRows = useEditorStore((s) => s.originalRows);
  const editorScenarioId = useEditorStore((s) => s.scenarioId);
  const setResult = useEditorStore((s) => s.setResult);
  const submit = useSubmitJob();
  const toast = useToast();

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [lastSolver, setLastSolver] = useState<SolverName | null>(null);
  const [lastReference, setLastReference] = useState<Date | null>(null);
  /**
   * 어떤 입력으로 제출됐는지 (stitch 시 같은 source 의 rows 와 매칭).
   * - 'edited': currentRows 기반
   * - 'original': originalRows 기반
   */
  const [lastSubmitSource, setLastSubmitSource] = useState<'edited' | 'original'>('edited');
  /** stitch 시 매칭에 사용할 row 스냅샷 (제출 시점 기준). */
  const [lastSubmitRows, setLastSubmitRows] = useState<Assignment[] | null>(null);
  /** stitch 처리 1회만. */
  const [stitchedJobIds, setStitchedJobIds] = useState<Set<string>>(new Set());

  // 시나리오 바뀌면 진행 중이던 job 추적 종료 + stitch 캐시 리셋.
  // (다른 시나리오의 rows 와 stitch 되는 것 방지)
  useEffect(() => {
    setActiveJobId(null);
    setStitchedJobIds(new Set());
    setLastSolver(null);
    setLastReference(null);
    setLastSubmitRows(null);
  }, [editorScenarioId]);

  const polling = usePollingJobResult(activeJobId);

  // succeeded 잡히면 stitch + setResult 한 번만.
  useEffect(() => {
    if (!activeJobId) return;
    if (!polling.data) return;
    if (polling.data.status !== 'succeeded') return;
    if (stitchedJobIds.has(activeJobId)) return;
    if (!lastReference || !lastSolver) return;
    if (!lastSubmitRows) return;

    // stitch 는 "제출 시점에 보낸 rows" 와 매칭. (편집/원본 어느 source 든 같은 voyage 매칭)
    const { rows, unmatched } = stitchResult(
      polling.data.schedule,
      lastSubmitRows,
      lastReference,
    );
    setResult({
      jobId: activeJobId,
      solver: lastSolver,
      rows,
      referenceIso: lastReference.toISOString(),
      unmatched,
      objectiveValue: polling.data.objective_value ?? null,
      elapsedSeconds: polling.data.elapsed_seconds ?? null,
      storedAt: new Date().toISOString(),
    });
    setStitchedJobIds((prev) => {
      const next = new Set(prev);
      next.add(activeJobId);
      return next;
    });
    if (unmatched.length > 0) {
      toast.notify({
        tone: 'warning',
        title: '일부 vessel 매칭 실패',
        description: `${unmatched.length}건 — voyage: ${unmatched.slice(0, 3).join(', ')}…`,
      });
    } else {
      toast.notify({
        tone: 'success',
        title: '솔버 결과 stitch 완료',
        description: `${rows.length}척 · obj=${polling.data.objective_value?.toFixed(2) ?? '-'}`,
      });
    }
  }, [
    activeJobId,
    polling.data,
    stitchedJobIds,
    lastReference,
    lastSolver,
    lastSubmitRows,
    setResult,
    toast,
  ]);

  // failed 처리.
  useEffect(() => {
    if (!polling.data) return;
    if (polling.data.status !== 'failed') return;
    toast.notify({
      tone: 'danger',
      title: '솔버 실행 실패',
      description: polling.data.error_message ?? '사유 미지정',
    });
    setActiveJobId(null);
  }, [polling.data, toast]);

  const submitWithSource = useCallback(
    (solver: SolverName, source: 'edited' | 'original') => {
      const sourceRows = source === 'edited' ? currentRows : originalRows;
      const check = adapterCheck(sourceRows);
      if (!check.ok) {
        toast.notify({
          tone: 'danger',
          title: '제출 차단 — 어댑터 검증 실패',
          description: check.blocking[0],
        });
        return { check };
      }
      if (check.warnings.length > 0) {
        toast.notify({
          tone: 'warning',
          title: `경고 ${check.warnings.length}건 (제출은 진행)`,
          description: check.warnings[0],
        });
      }
      const built = buildOptimizeRequest(sourceRows, solver);
      setLastSolver(solver);
      setLastReference(built.reference);
      setLastSubmitSource(source);
      // 제출 시점의 rows snapshot 보관 (이후 currentRows 가 바뀌어도 stitch 일관성).
      setLastSubmitRows(sourceRows.map((r) => ({ ...r })));
      submit.mutate(built.request, {
        onSuccess: (accepted) => {
          setActiveJobId(accepted.job_id);
          toast.notify({
            tone: 'info',
            title: source === 'edited' ? '편집본 솔버 제출됨' : '원본 시나리오 솔버 제출됨',
            description: `${solver.toUpperCase()} · ${sourceRows.length}척 · job=${accepted.job_id.slice(0, 8)}…`,
          });
        },
        onError: (err) =>
          toast.notify({
            tone: 'danger',
            title: '제출 실패',
            description: extractErrorMessage(err),
          }),
      });
      return { check };
    },
    [currentRows, originalRows, submit, toast],
  );

  const submit_ = useCallback(
    (solver: SolverName) => submitWithSource(solver, 'edited'),
    [submitWithSource],
  );
  const submitOriginal = useCallback(
    (solver: SolverName) => submitWithSource(solver, 'original'),
    [submitWithSource],
  );

  const cancel = useCallback(() => {
    // 백엔드 cancel API 가 없어 클라이언트측 폴링만 중단.
    setActiveJobId(null);
  }, []);

  const status: SubmitState['pollingStatus'] = (() => {
    if (!activeJobId) return 'idle';
    if (!polling.data) return 'queued';
    if (polling.data.status === 'succeeded') return 'succeeded';
    if (polling.data.status === 'failed') return 'failed';
    return 'running';
  })();

  return {
    /** 현재 편집본(currentRows) 으로 제출. */
    submit: submit_,
    /** 원본 시나리오(originalRows) 그대로 제출. 솔버 결과를 받아 편집기로 가져오는 흐름의 시작점. */
    submitOriginal,
    cancel,
    isSubmitting: submit.isPending,
    activeJobId,
    pollingStatus: status,
    pollingResult: polling.data,
    pollingError: polling.error ? extractErrorMessage(polling.error) : null,
    /** edited / original 각각의 어댑터 검증 결과. UI 가 두 버튼 disabled 판단에 사용. */
    checkEdited: adapterCheck(currentRows),
    checkOriginal: adapterCheck(originalRows),
    /** 마지막 제출이 어떤 source 였는지. */
    lastSubmitSource,
  };
}
