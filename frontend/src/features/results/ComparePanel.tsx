import styled from '@emotion/styled';
import { GitCompareArrows } from 'lucide-react';
import { Suspense, lazy } from 'react';

import { Card } from '@/shared/ui/Card';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Skeleton } from '@/shared/ui/Skeleton';

// Plotly 가 들어간 ResultGantt 는 lazy. 사용자가 '결과 비교' 까지 스크롤 와야 청크 받음.
const ResultGantt = lazy(() =>
  import('./ResultGantt').then((m) => ({ default: m.ResultGantt })),
);

const Grid = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.spacing(3),

  '@media (max-width: 1024px)': {
    gridTemplateColumns: '1fr',
  },
}));

interface Props {
  leftJobId: string | null;
  rightJobId: string | null;
}

export function ComparePanel({ leftJobId, rightJobId }: Props) {
  return (
    <Card>
      <SectionHeader
        icon={GitCompareArrows}
        number="04"
        title="결과 비교"
        description="두 작업 결과의 간트를 나란히 표시. 작업 이력에서 좌/우 슬롯에 작업을 배치하세요."
      />
      <Grid>
        <Suspense fallback={<Skeleton height={460} radius="md" />}>
          <ResultGantt jobId={leftJobId} label="좌" />
        </Suspense>
        <Suspense fallback={<Skeleton height={460} radius="md" />}>
          <ResultGantt jobId={rightJobId} label="우" />
        </Suspense>
      </Grid>
    </Card>
  );
}
