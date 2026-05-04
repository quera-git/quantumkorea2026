import styled from '@emotion/styled';
import { Cpu, Loader2, Play, X } from 'lucide-react';
import { useState } from 'react';

import { useEditorSubmit } from '@/features/solver-adapter/useEditorSubmit';
import { Button } from '@/shared/ui/Button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Stack } from '@/shared/ui/Stack';
import { SOLVER_NAMES, type SolverName } from '@/shared/types/schema';

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

export function EditorActionsBar() {
  const [solver, setSolver] = useState<SolverName>('cqm');
  const submitFlow = useEditorSubmit();

  const isBusy =
    submitFlow.isSubmitting ||
    submitFlow.pollingStatus === 'running' ||
    submitFlow.pollingStatus === 'queued';

  const blocking = submitFlow.check.blocking;
  const warnings = submitFlow.check.warnings;
  const canSubmit = submitFlow.check.ok && !isBusy;

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
          onClick={() => submitFlow.submit(solver)}
          disabled={!canSubmit}
          aria-label="편집본 솔버 제출"
        >
          {submitFlow.isSubmitting ? (
            <>
              <Loader2 size={14} aria-hidden="true" /> 제출 중…
            </>
          ) : (
            <>
              <Play size={14} aria-hidden="true" /> 편집본 솔버 제출
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

      {blocking.length > 0 && (
        <Notice tone="danger" role="alert">
          ❌ 제출 차단 ({blocking.length}건):{' '}
          {blocking.slice(0, 2).join(' · ')}
          {blocking.length > 2 && ` 외 ${blocking.length - 2}건`}
        </Notice>
      )}
      {blocking.length === 0 && warnings.length > 0 && (
        <Notice tone="warning">
          ⚠ 경고 {warnings.length}건 (제출은 가능): {warnings.slice(0, 2).join(' · ')}
        </Notice>
      )}
    </Stack>
  );
}
