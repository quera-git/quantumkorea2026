import styled from '@emotion/styled';
import { Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

import { extractErrorMessage } from '@/shared/api/client';
import { Card } from '@/shared/ui/Card';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import type { OptimizeResult } from '@/shared/types/schema';

import { usePollingJobResult } from './jobs.queries';

const StatGrid = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: theme.spacing(2),
}));

const Stat = styled.div(({ theme }) => ({
  padding: theme.spacing(3),
  background: theme.color.surfaceAlt,
  borderRadius: theme.radius.md,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  '& .label': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.letter.wide,
  },
  '& .value': {
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    color: theme.color.text,
    fontFamily: theme.font.mono,
    letterSpacing: theme.font.letter.tight,
  },
  '& .small': {
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    color: theme.color.textSubtle,
    wordBreak: 'break-all',
  },
}));

const ErrorBox = styled.div(({ theme }) => ({
  padding: theme.spacing(3),
  background: theme.color.dangerSoft,
  border: `1px solid ${theme.color.danger}33`,
  borderRadius: theme.radius.md,
  color: theme.color.danger,
  fontSize: theme.font.size.sm,
}));

interface Props {
  jobId: string;
}

export function JobProgressCard({ jobId }: Props) {
  const { data, error, isLoading } = usePollingJobResult(jobId);
  const [tickElapsed, setTickElapsed] = useState(0);

  useEffect(() => {
    if (!data || (data.status !== 'running' && data.status !== 'pending')) return;
    const startedAt = data.started_at ? Date.parse(data.started_at) : Date.now();
    const tick = setInterval(() => {
      setTickElapsed((Date.now() - startedAt) / 1000);
    }, 1000);
    return () => clearInterval(tick);
  }, [data]);

  if (isLoading || !data) {
    return (
      <Card>
        <SectionHeader icon={Activity} title="진행 상태" description="결과 조회 중…" />
        <StatGrid>
          <Stat>
            <span className="label">job_id</span>
            <Skeleton width={140} height={20} />
          </Stat>
          <Stat>
            <span className="label">경과</span>
            <Skeleton width={80} height={28} />
          </Stat>
        </StatGrid>
      </Card>
    );
  }

  if (error) {
    return (
      <Card tone="danger">
        <SectionHeader icon={Activity} title="진행 상태" />
        <ErrorBox>폴링 실패: {extractErrorMessage(error)}</ErrorBox>
      </Card>
    );
  }

  return <ProgressContent jobId={jobId} result={data} tickElapsed={tickElapsed} />;
}

function ProgressContent({
  jobId,
  result,
  tickElapsed,
}: {
  jobId: string;
  result: OptimizeResult;
  tickElapsed: number;
}) {
  const isRunning = result.status === 'running' || result.status === 'pending';
  const elapsed = isRunning ? tickElapsed : (result.elapsed_seconds ?? 0);
  const tone = result.status === 'failed' ? 'danger' : 'default';

  return (
    <Card tone={tone}>
      <SectionHeader
        icon={Activity}
        title="진행 상태"
        aside={<StatusBadge status={result.status} />}
      />

      <Stack gap={3}>
        <StatGrid>
          <Stat>
            <span className="label">경과</span>
            <span className="value">{elapsed.toFixed(1)}s</span>
          </Stat>
          {result.objective_value != null && (
            <Stat>
              <span className="label">objective</span>
              <span className="value">{result.objective_value.toFixed(2)}</span>
            </Stat>
          )}
          {!isRunning && result.elapsed_seconds != null && (
            <Stat>
              <span className="label">총 소요</span>
              <span className="value">{result.elapsed_seconds.toFixed(1)}s</span>
            </Stat>
          )}
          <Stat>
            <span className="label">job_id</span>
            <span className="small">{jobId}</span>
          </Stat>
        </StatGrid>

        {result.error_message && <ErrorBox>{result.error_message}</ErrorBox>}
      </Stack>
    </Card>
  );
}
