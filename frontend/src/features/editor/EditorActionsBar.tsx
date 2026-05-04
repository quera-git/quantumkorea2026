import styled from '@emotion/styled';
import { Cpu, Loader2, Play, X } from 'lucide-react';
import { useState } from 'react';

import { useEditorStore } from '@/features/editor/editor.store';
import { useEditorSubmit } from '@/features/solver-adapter/useEditorSubmit';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Stack } from '@/shared/ui/Stack';
import { SOLVER_NAMES, type SolverName } from '@/shared/types/schema';

const SOLVER_WARNING: Record<SolverName, { warn: string; cost: string }> = {
  cqm: {
    warn: 'D-Wave Leap 시간을 소모합니다',
    cost: '실 비용 발생 (학술 무료 한도 내라도 분 단위 차감)',
  },
  hybrid: {
    warn: 'D-Wave Leap 시간을 소모합니다',
    cost: '실 비용 발생 (학술 무료 한도 내라도 분 단위 차감)',
  },
  gurobi: {
    warn: 'Gurobi 라이선스 검증이 발생합니다',
    cost: '도커 환경의 단일 머신 학술 라이선스는 거부될 가능성 있음 (로그 확인 권장)',
  },
};

const Bar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(3),
  padding: theme.spacing(3),
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  background: theme.color.surface,
  flexWrap: 'wrap',

  '& .label': {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
  },
}));

const RadioRow = styled.div(({ theme }) => ({
  display: 'inline-flex',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',

  '& button': {
    padding: '6px 12px',
    fontSize: theme.font.size.sm,
    background: 'transparent',
    border: 'none',
    color: theme.color.textMuted,
    cursor: 'pointer',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
    fontFamily: theme.font.mono,
  },
  '& button + button': { borderLeft: `1px solid ${theme.color.border}` },
  '& button:hover': { background: theme.color.surfaceAlt },
  '& button[data-active="true"]': {
    background: theme.color.primarySoft,
    color: theme.color.primary,
    fontWeight: theme.font.weight.semibold,
  },
  '& button:focus-visible': {
    outline: 'none',
    boxShadow: theme.shadow.focus,
    position: 'relative',
    zIndex: 1,
  },
}));

const StatusBlock = styled.div(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  fontSize: theme.font.size.sm,
  fontFamily: theme.font.mono,
  color: theme.color.textMuted,
}));

const Notice = styled.div<{ tone: 'warning' | 'danger' }>(({ theme, tone }) => ({
  width: '100%',
  padding: theme.spacing(2),
  borderRadius: theme.radius.md,
  fontSize: theme.font.size.sm,
  background: tone === 'danger' ? theme.color.dangerSoft : theme.color.warningSoft,
  color: tone === 'danger' ? theme.color.danger : theme.color.warning,
  border: `1px solid ${tone === 'danger' ? theme.color.danger : theme.color.warning}33`,
}));

type Source = 'edited' | 'original';

export function EditorActionsBar() {
  const [solver, setSolver] = useState<SolverName>('cqm');
  const [confirmSource, setConfirmSource] = useState<Source | null>(null);
  const submitFlow = useEditorSubmit();
  const currentRows = useEditorStore((s) => s.currentRows);
  const originalRows = useEditorStore((s) => s.originalRows);
  const isDirty = useEditorStore((s) => s.isDirty());

  const isBusy =
    submitFlow.isSubmitting ||
    submitFlow.pollingStatus === 'running' ||
    submitFlow.pollingStatus === 'queued';

  const blockingEdited = submitFlow.checkEdited.blocking;
  const warningsEdited = submitFlow.checkEdited.warnings;
  const blockingOriginal = submitFlow.checkOriginal.blocking;
  const canSubmitEdited = submitFlow.checkEdited.ok && !isBusy;
  const canSubmitOriginal = submitFlow.checkOriginal.ok && !isBusy;

  function requestSubmit(source: Source) {
    if (source === 'edited' && !canSubmitEdited) return;
    if (source === 'original' && !canSubmitOriginal) return;
    setConfirmSource(source);
  }

  function confirmSubmit() {
    if (confirmSource === 'edited') submitFlow.submit(solver);
    else if (confirmSource === 'original') submitFlow.submitOriginal(solver);
    setConfirmSource(null);
  }

  const solverInfo = SOLVER_WARNING[solver];
  const tone: 'warning' | 'danger' = solver === 'gurobi' ? 'danger' : 'warning';
  const sourceRowsForConfirm =
    confirmSource === 'edited'
      ? currentRows
      : confirmSource === 'original'
        ? originalRows
        : currentRows;

  return (
    <Stack gap={2}>
      <Bar>
        <span className="label">솔버</span>
        <RadioRow role="radiogroup" aria-label="솔버 선택">
          {SOLVER_NAMES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={solver === s}
              data-active={solver === s}
              onClick={() => setSolver(s)}
              disabled={isBusy}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </RadioRow>

        <Button
          variant="secondary"
          onClick={() => requestSubmit('original')}
          disabled={!canSubmitOriginal}
          aria-label="원본 시나리오 솔버 제출"
          title="편집 전 원본 시나리오를 솔버에 넣어 결과를 받음. 결과는 ‘편집기로 불러오기’ 로 가져와 위에서 추가 수정 가능."
        >
          <Play size={14} aria-hidden="true" /> 원본 → 솔버
        </Button>

        <Button
          onClick={() => requestSubmit('edited')}
          disabled={!canSubmitEdited || !isDirty}
          aria-label="편집본 솔버 제출"
          title={isDirty ? '현재 편집된 상태를 솔버에 제출' : '편집한 게 없습니다 (원본과 동일)'}
        >
          {submitFlow.isSubmitting && submitFlow.lastSubmitSource === 'edited' ? (
            <>
              <Loader2 size={14} aria-hidden="true" /> 제출 중…
            </>
          ) : (
            <>
              <Play size={14} aria-hidden="true" /> 편집본 → 솔버
            </>
          )}
        </Button>

        {isBusy && submitFlow.activeJobId && (
          <StatusBlock>
            <Cpu size={14} aria-hidden="true" />
            <span>{submitFlow.activeJobId.slice(0, 8)}…</span>
            <StatusBadge
              status={
                submitFlow.pollingStatus === 'succeeded'
                  ? 'succeeded'
                  : submitFlow.pollingStatus === 'failed'
                    ? 'failed'
                    : 'running'
              }
            />
            <Button variant="ghost" size="sm" onClick={submitFlow.cancel} aria-label="제출 추적 중단">
              <X size={12} aria-hidden="true" />
            </Button>
          </StatusBlock>
        )}
      </Bar>

      {blockingEdited.length > 0 && (
        <Notice tone="danger" role="alert">
          ❌ 편집본 제출 차단 ({blockingEdited.length}건):{' '}
          {blockingEdited.slice(0, 2).join(' · ')}
          {blockingEdited.length > 2 && ` 외 ${blockingEdited.length - 2}건`}
        </Notice>
      )}
      {blockingEdited.length === 0 && warningsEdited.length > 0 && (
        <Notice tone="warning">
          ⚠ 편집본 경고 {warningsEdited.length}건 (제출은 가능):{' '}
          {warningsEdited.slice(0, 2).join(' · ')}
        </Notice>
      )}
      {blockingOriginal.length > 0 && (
        <Notice tone="danger" role="alert">
          ❌ 원본도 어댑터 검증 실패 ({blockingOriginal.length}건):{' '}
          {blockingOriginal.slice(0, 2).join(' · ')}
        </Notice>
      )}

      <ConfirmDialog
        open={confirmSource !== null}
        tone={tone}
        title={`${solver.toUpperCase()} 솔버 제출 확인`}
        description={
          <>
            <strong>입력:</strong>{' '}
            {confirmSource === 'edited' ? '현재 편집본' : '원본 시나리오 (편집 전)'}.
            <br />
            <strong>{solverInfo.warn}.</strong> 한 번 누르면 작업이 큐에 들어가 바로 자원이
            소모됩니다. {solverInfo.cost}.
            <br />
            제출 직전에 한 번 더 확인하세요.
          </>
        }
        detail={
          <>
            solver = <strong>{solver.toUpperCase()}</strong>
            <br />
            입력 = <strong>{confirmSource === 'edited' ? '편집본' : '원본'}</strong> /
            BPT 레코드 = <strong>{sourceRowsForConfirm.length}</strong>척
            <br />
            예상 소요 = cqm 약 5~30s · hybrid 약 1~5분 · gurobi 라이선스 OK 시 즉시
          </>
        }
        confirmLabel="이대로 제출"
        cancelLabel="취소"
        onConfirm={confirmSubmit}
        onCancel={() => setConfirmSource(null)}
      />
    </Stack>
  );
}
