import styled from '@emotion/styled';
import { Cpu, Play } from 'lucide-react';
import { useState } from 'react';

import { useBptList } from '@/features/bpt/bpt.queries';
import { extractErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Stack } from '@/shared/ui/Stack';
import { useToast } from '@/shared/ui/Toast';
import { SOLVER_NAMES, type SolverName } from '@/shared/types/schema';

import { useSubmitJob } from './jobs.queries';

const RadioRow = styled.div(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  flexWrap: 'wrap',

  label: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: '7px 12px',
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    fontSize: theme.font.size.sm,
    background: theme.color.surface,
    transition: `border-color ${theme.motion.duration.fast} ${theme.motion.easing.standard}, background ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  },
  'label:hover': {
    background: theme.color.surfaceAlt,
  },
  'label:has(input:checked)': {
    borderColor: theme.color.primary,
    background: theme.color.primarySoft,
    color: theme.color.primary,
    fontWeight: theme.font.weight.semibold,
  },
  'label:has(input:focus-visible)': {
    boxShadow: theme.shadow.focus,
  },
  input: {
    accentColor: theme.color.primary,
  },
}));

const NumberInput = styled.input(({ theme }) => ({
  width: 100,
  padding: '6px 8px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  fontFamily: theme.font.mono,
  fontSize: theme.font.size.sm,
  background: theme.color.surface,

  '&:focus-visible': {
    outline: 'none',
    borderColor: theme.color.primary,
    boxShadow: theme.shadow.focus,
  },
}));

const FieldLabel = styled.label(({ theme }) => ({
  fontSize: theme.font.size.xs,
  fontWeight: theme.font.weight.semibold,
  color: theme.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: theme.font.letter.wide,
}));

const HelperText = styled.span(({ theme }) => ({
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
  fontFamily: theme.font.mono,
}));

interface Props {
  /** 제출 성공 시 호출되어 진행 카드로 전환된다. */
  onSubmitted: (jobId: string) => void;
}

export function SolverPanel({ onSubmitted }: Props) {
  const bpt = useBptList();
  const submit = useSubmitJob();
  const toast = useToast();

  const [solver, setSolver] = useState<SolverName>('gurobi');
  const [planningStart, setPlanningStart] = useState<number>(0);

  const records = bpt.data ?? [];
  const canSubmit = records.length > 0 && !submit.isPending;

  function handleSubmit() {
    submit.mutate(
      {
        bpt_records: records,
        solver,
        planning_start_time: planningStart,
      },
      {
        onSuccess: (accepted) => {
          onSubmitted(accepted.job_id);
          toast.notify({
            tone: 'info',
            title: '솔버 작업 제출됨',
            description: `${solver.toUpperCase()} · ${records.length}척 → polling…`,
          });
        },
        onError: (e) =>
          toast.notify({
            tone: 'danger',
            title: '솔버 제출 실패',
            description: extractErrorMessage(e),
          }),
      },
    );
  }

  return (
    <Card>
      <SectionHeader
        icon={Cpu}
        number="02"
        title="최적화 실행"
        description={
          <>
            현재 적재된 BPT <strong>{records.length}</strong>건을 입력으로 솔버에 제출합니다. 결과는{' '}
            <code>GET /results/&#123;jobId&#125;</code> 폴링으로 받습니다.
          </>
        }
      />

      <Stack gap={4}>
        <Stack gap={2}>
          <FieldLabel>솔버</FieldLabel>
          <RadioRow>
            {SOLVER_NAMES.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="solver"
                  value={s}
                  checked={solver === s}
                  onChange={() => setSolver(s)}
                />
                {s}
              </label>
            ))}
          </RadioRow>
        </Stack>

        <Stack direction="row" gap={3} align="center" wrap>
          <FieldLabel htmlFor="planningStart">planning_start_time</FieldLabel>
          <NumberInput
            id="planningStart"
            type="number"
            step="0.5"
            value={planningStart}
            onChange={(e) => setPlanningStart(Number(e.target.value))}
          />
          <HelperText>(시간 단위. 노트북 기본 0/14.5/80)</HelperText>
        </Stack>

        <Stack direction="row" gap={2} align="center" wrap>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Play size={14} aria-hidden="true" />
            {submit.isPending ? '제출 중…' : '최적화 실행'}
          </Button>
          {records.length === 0 && <HelperText>BPT 데이터를 먼저 적재하세요.</HelperText>}
        </Stack>
      </Stack>
    </Card>
  );
}
