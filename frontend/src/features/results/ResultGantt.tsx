import styled from '@emotion/styled';

import { useJobResult } from '@/features/jobs/jobs.queries';
import { extractErrorMessage } from '@/shared/api/client';
import { Stack } from '@/shared/ui/Stack';
import { StatusBadge } from '@/shared/ui/StatusBadge';

import { GanttChart } from './GanttChart';

const Wrap = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.spacing(3),
  background: theme.color.surface,
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),

  h3: {
    margin: 0,
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
  },
  '.meta': {
    fontSize: theme.font.size.xs,
    color: theme.color.textMuted,
    fontFamily: theme.font.mono,
  },
}));

const Empty = styled.div(({ theme }) => ({
  padding: theme.spacing(8),
  textAlign: 'center',
  color: theme.color.textMuted,
  fontSize: theme.font.size.sm,
}));

interface Props {
  jobId: string | null;
  label: string;
  height?: number;
}

export function ResultGantt({ jobId, label, height = 420 }: Props) {
  const { data, error, isLoading } = useJobResult(jobId);

  if (!jobId) {
    return (
      <Wrap>
        <Header>
          <h3>{label}</h3>
          <span className="meta">미선택</span>
        </Header>
        <Empty>비교할 작업을 선택하세요.</Empty>
      </Wrap>
    );
  }

  if (isLoading) {
    return (
      <Wrap>
        <Header>
          <h3>{label}</h3>
        </Header>
        <Empty>결과 로딩 중…</Empty>
      </Wrap>
    );
  }

  if (error) {
    return (
      <Wrap>
        <Header>
          <h3>{label}</h3>
        </Header>
        <Empty>{extractErrorMessage(error)}</Empty>
      </Wrap>
    );
  }

  if (!data) {
    return (
      <Wrap>
        <Header>
          <h3>{label}</h3>
        </Header>
        <Empty>데이터 없음.</Empty>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Header>
        <Stack direction="row" align="center" gap={2}>
          <h3>{label}</h3>
          <StatusBadge status={data.status} />
        </Stack>
        <span className="meta">
          obj={data.objective_value?.toFixed(2) ?? '-'} · {data.elapsed_seconds?.toFixed(1) ?? '-'}s
          · {data.schedule.length}척
        </span>
      </Header>
      <GanttChart schedule={data.schedule} height={height} />
    </Wrap>
  );
}
