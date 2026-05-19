import styled from '@emotion/styled';
import { History, Inbox, Loader2 } from 'lucide-react';

import { extractErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Skeleton, SkeletonStack } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';
import { StatusBadge } from '@/shared/ui/StatusBadge';

import { useJobsList } from './jobs.queries';

const ScrollArea = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  background: theme.color.surface,
  maxHeight: 320,
  overflowY: 'auto',
}));

const Table = styled.table(({ theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: theme.font.size.sm,

  thead: {
    background: theme.color.surfaceAlt,
    position: 'sticky',
    top: 0,
  },
  th: {
    fontWeight: theme.font.weight.semibold,
    color: theme.color.textMuted,
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.color.border}`,
    whiteSpace: 'nowrap',
    fontSize: theme.font.size.xs,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
  },
  td: {
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.color.borderSubtle}`,
    whiteSpace: 'nowrap',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  },
  'tbody tr:last-of-type td': {
    borderBottom: 'none',
  },
  'tbody tr:hover td': {
    background: theme.color.surfaceAlt,
  },
  'tr.selected td': {
    background: theme.color.primarySoft,
  },
  'td.mono': {
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
  },
}));

const ErrorBox = styled.div(({ theme }) => ({
  padding: theme.spacing(2),
  background: theme.color.dangerSoft,
  border: `1px solid ${theme.color.danger}33`,
  borderRadius: theme.radius.md,
  color: theme.color.danger,
  fontSize: theme.font.size.sm,
}));

interface Props {
  leftJobId: string | null;
  rightJobId: string | null;
  onSelectLeft: (jobId: string) => void;
  onSelectRight: (jobId: string) => void;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export function JobsListPanel({ leftJobId, rightJobId, onSelectLeft, onSelectRight }: Props) {
  const list = useJobsList();
  const jobs = list.data ?? [];

  return (
    <Card>
      <SectionHeader
        icon={History}
        number="03"
        title="작업 이력"
        description="완료된 작업의 결과를 좌/우 비교 슬롯에 선택해 두 결과를 나란히 비교하세요."
        aside={
          list.isFetching ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Loader2 size={11} aria-hidden="true" /> 갱신 중
            </span>
          ) : null
        }
      />

      {list.error && <ErrorBox>{extractErrorMessage(list.error)}</ErrorBox>}

      {list.isLoading ? (
        <SkeletonStack>
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </SkeletonStack>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="아직 제출된 작업이 없습니다"
          description="좌측 02 패널에서 솔버를 실행하면 작업 이력이 여기에 쌓입니다."
        />
      ) : (
        <ScrollArea>
          <Table>
            <thead>
              <tr>
                <th>job_id</th>
                <th>solver</th>
                <th>status</th>
                <th>obj.</th>
                <th>elapsed</th>
                <th>started</th>
                <th>비교</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const isLeft = leftJobId === j.job_id;
                const isRight = rightJobId === j.job_id;
                const finished = j.status === 'succeeded';
                return (
                  <tr key={j.job_id} className={isLeft || isRight ? 'selected' : ''}>
                    <td className="mono">{shortId(j.job_id)}</td>
                    <td>{j.solver}</td>
                    <td>
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="mono">{j.objective_value?.toFixed(2) ?? '-'}</td>
                    <td className="mono">
                      {j.elapsed_seconds !== null ? `${j.elapsed_seconds.toFixed(1)}s` : '-'}
                    </td>
                    <td className="mono">{formatTime(j.started_at)}</td>
                    <td>
                      <Stack direction="row" gap={1}>
                        <Button
                          size="sm"
                          variant={isLeft ? 'primary' : 'secondary'}
                          disabled={!finished}
                          onClick={() => onSelectLeft(j.job_id)}
                        >
                          좌
                        </Button>
                        <Button
                          size="sm"
                          variant={isRight ? 'primary' : 'secondary'}
                          disabled={!finished}
                          onClick={() => onSelectRight(j.job_id)}
                        >
                          우
                        </Button>
                      </Stack>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
