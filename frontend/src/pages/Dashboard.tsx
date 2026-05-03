import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { useState } from 'react';

import { BptPanel } from '@/features/bpt/BptPanel';
import { JobProgressCard } from '@/features/jobs/JobProgressCard';
import { JobsListPanel } from '@/features/jobs/JobsListPanel';
import { SolverPanel } from '@/features/jobs/SolverPanel';
import { ComparePanel } from '@/features/results/ComparePanel';
import { ScenarioPanel } from '@/features/scenario/ScenarioPanel';
import { AppBar } from '@/shared/ui/AppBar';
import { Stack } from '@/shared/ui/Stack';

const Page = styled.div(({ theme }) => ({
  minHeight: '100vh',
  background: theme.color.bg,
}));

const Container = styled.div(({ theme }) => ({
  maxWidth: 1280,
  margin: '0 auto',
  padding: `${theme.spacing(8)} ${theme.spacing(6)}`,

  '@media (max-width: 768px)': {
    padding: `${theme.spacing(5)} ${theme.spacing(3)}`,
  },
}));

const PageTitle = styled.h1(({ theme }) => ({
  margin: 0,
  fontSize: theme.font.size.title,
  fontWeight: theme.font.weight.bold,
  color: theme.color.text,
  letterSpacing: theme.font.letter.tight,
}));

const PageSubtitle = styled.p(({ theme }) => ({
  margin: 0,
  marginTop: theme.spacing(2),
  fontSize: theme.font.size.md,
  color: theme.color.textMuted,
  maxWidth: 720,
  lineHeight: theme.font.lineHeight.normal,
}));

const TopGrid = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 380px',
  gap: theme.spacing(4),
  alignItems: 'start',

  '@media (max-width: 1024px)': {
    gridTemplateColumns: '1fr',
  },
}));

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Section = styled.div<{ delay?: number }>(({ theme, delay = 0 }) => ({
  animation: `${fadeUp} ${theme.motion.duration.slow} ${theme.motion.easing.enter} both`,
  animationDelay: `${delay}ms`,
}));

const PlaceholderCard = styled.div(({ theme }) => ({
  border: `1px dashed ${theme.color.borderSubtle}`,
  borderRadius: theme.radius.xl,
  padding: theme.spacing(6),
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  background: theme.color.surfaceAlt,
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  minHeight: 160,
}));

export default function Dashboard() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [leftJobId, setLeftJobId] = useState<string | null>(null);
  const [rightJobId, setRightJobId] = useState<string | null>(null);

  function handleSubmitted(jobId: string) {
    setActiveJobId(jobId);
    if (!leftJobId) setLeftJobId(jobId);
    else if (!rightJobId) setRightJobId(jobId);
  }

  return (
    <Page>
      <AppBar />
      <Container>
        <Stack gap={6}>
          <Section>
            <Stack gap={1}>
              <PageTitle>선석 배정 양자 최적화</PageTitle>
              <PageSubtitle>
                BPT 데이터 적재 → 솔버 제출 → 결과 폴링 → 두 작업 결과 비교 + Streamlit 풍부 도메인
                시각화 (MVP-1).
              </PageSubtitle>
            </Stack>
          </Section>

          <Section delay={40}>
            <BptPanel />
          </Section>

          <Section delay={80}>
            <TopGrid>
              <SolverPanel onSubmitted={handleSubmitted} />
              {activeJobId ? (
                <JobProgressCard jobId={activeJobId} />
              ) : (
                <PlaceholderCard>
                  제출된 작업이 없습니다.
                  <br />
                  좌측에서 솔버를 실행하면 진행 상태가 여기에 표시됩니다.
                </PlaceholderCard>
              )}
            </TopGrid>
          </Section>

          <Section delay={120}>
            <JobsListPanel
              leftJobId={leftJobId}
              rightJobId={rightJobId}
              onSelectLeft={setLeftJobId}
              onSelectRight={setRightJobId}
            />
          </Section>

          <Section delay={160}>
            <ComparePanel leftJobId={leftJobId} rightJobId={rightJobId} />
          </Section>

          <Section delay={200}>
            <ScenarioPanel />
          </Section>
        </Stack>
      </Container>
    </Page>
  );
}
