import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { Database, Layers } from 'lucide-react';
import { useState } from 'react';

import { BptPanel } from '@/features/bpt/BptPanel';
import { SelectedVesselPanel } from '@/features/editor/SelectedVesselPanel';
import { JobProgressCard } from '@/features/jobs/JobProgressCard';
import { JobsListPanel } from '@/features/jobs/JobsListPanel';
import { SolverPanel } from '@/features/jobs/SolverPanel';
import { ComparePanel } from '@/features/results/ComparePanel';
import { ScenarioPanel } from '@/features/scenario/ScenarioPanel';
import { AppBar } from '@/shared/ui/AppBar';
import { SectionGroup } from '@/shared/ui/SectionGroup';
import { SectionNav, type NavGroup } from '@/shared/ui/SectionNav';
import { ShortcutModal } from '@/shared/ui/ShortcutModal';
import { Stack } from '@/shared/ui/Stack';

const Page = styled.div(({ theme }) => ({
  minHeight: '100vh',
  background: theme.color.bg,
}));

const Layout = styled.div(({ theme }) => ({
  // 좌측 pin — center 가 아니라 화면 왼쪽 끝에 sidebar 부착, main 은 viewport 끝까지 확장.
  // gantt/timeline 이 가로로 길어 wide-screen 일수록 이득.
  width: '100%',
  display: 'grid',
  gridTemplateColumns: '224px minmax(0, 1fr)',
  alignItems: 'start',

  '@media (max-width: 1024px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },

  '& > *': { minWidth: 0 },
  '& > main': {
    padding: `${theme.spacing(8)} ${theme.spacing(6)}`,
    // 아주 큰 모니터 (≥1920px) 에서 줄이 너무 길어지지 않게 본문 텍스트만 maxWidth.
    // gantt 차트는 자체 width:100% 라 풀폭 유지.

    '@media (max-width: 1024px)': {
      padding: `${theme.spacing(5)} ${theme.spacing(3)}`,
    },
    '@media (max-width: 640px)': {
      padding: `${theme.spacing(4)} ${theme.spacing(2)}`,
    },
  },
}));

/**
 * 좌측 사이드바 — Notion/Linear 패턴: 사이드바 전체가 한 단위로 sticky 하고
 * 내부에서만 scroll 됨. 메인 컬럼과 독립적인 scroll context 라 sticky overlap /
 * 본문이 사이드바 뒤로 비치는 문제가 발생하지 않음.
 *
 * 데스크탑:
 *   - position: sticky (top: 72) — AppBar 아래 위치
 *   - max-height: calc(100vh - 96px) — viewport 안에 갇힘
 *   - overflow-y: auto — SectionNav + SelectedVesselPanel 합쳐서 길어지면 내부 scroll
 *   - overscroll-behavior: contain — 사이드바 scroll 이 페이지 scroll 로 새지 않음
 *   - 스크롤바는 항상 미세하게 노출 (modern thin scrollbar) — content 가 잘려있다는 visual hint
 *
 * 모바일 (≤1024px):
 *   - sticky 해제 — SectionNav 자체가 horizontal strip 으로 자체 sticky
 *   - 세로 stack 으로 자연 흐름
 */
const LeftRail = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  paddingBottom: theme.spacing(6),

  position: 'sticky',
  top: 72,
  alignSelf: 'start',
  maxHeight: 'calc(100vh - 96px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  background: theme.color.bg,

  // Modern thin scrollbar — Notion/Linear/GitHub 스타일. content 보일 때만 hover/scroll 로 진해짐.
  scrollbarWidth: 'thin',
  scrollbarColor: `${theme.color.border} transparent`,
  '&::-webkit-scrollbar': { width: 6 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    background: theme.color.border,
    borderRadius: 3,
  },
  '&:hover::-webkit-scrollbar-thumb': { background: theme.color.borderStrong },

  '@media (max-width: 1024px)': {
    position: 'static',
    maxHeight: 'none',
    overflowY: 'visible',
    paddingBottom: 0,
    background: 'transparent',
  },
}));

/** SectionNav 아래에 자리잡는 vessel detail 영역 — 좁은 사이드에 맞춰 padding 만 적용. */
const VesselDetailHolder = styled.div(({ theme }) => ({
  padding: `0 ${theme.spacing(3)}`,

  '@media (max-width: 1024px)': {
    padding: `0 ${theme.spacing(4)}`,
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
  maxWidth: 760,
  lineHeight: theme.font.lineHeight.relaxed,
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

const Anim = styled.div<{ delay?: number }>(({ theme, delay = 0 }) => ({
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

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'scenario',
    label: '시나리오 분석',
    icon: Layers,
    anchors: [
      { id: 'scenario', label: '시나리오 + 편집' },
    ],
  },
  {
    id: 'bpt-workflow',
    label: 'BPT 직접 워크플로',
    icon: Database,
    anchors: [
      { id: 'bpt-data', label: 'BPT 데이터' },
      { id: 'bpt-solver', label: '솔버 작업' },
      { id: 'bpt-compare', label: '결과 비교' },
    ],
  },
];

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
      <a className="skip-to-content" href="#main-content">
        본문으로 건너뛰기
      </a>
      <AppBar />
      <ShortcutModal />
      <Layout>
        <LeftRail>
          <SectionNav groups={NAV_GROUPS} />
          <VesselDetailHolder>
            <SelectedVesselPanel />
          </VesselDetailHolder>
        </LeftRail>

        <main id="main-content" tabIndex={-1}>
          <Stack gap={8}>
            <Anim>
              <Stack gap={1}>
                <PageTitle>선석 배정 양자 최적화</PageTitle>
                <PageSubtitle>
                  부산항 (신선대 SND / 감만 GAM) 선석 배정 시뮬레이터. 좌측 nav 로 두 워크플로 사이를
                  오갈 수 있어요. <strong>시나리오 분석</strong>이 메인 흐름입니다.
                </PageSubtitle>
              </Stack>
            </Anim>

            <Anim delay={40}>
              <SectionGroup
                id="scenario"
                icon={Layers}
                label="MAIN"
                title="시나리오 분석 + 편집"
                description={
                  <>
                    실제 항만 운영 데이터에서 추출한 4개 시나리오 (0313 14:30 / 16:10, 0316 08:00 /
                    10:06) 를 SND/GAM 분할 타임라인으로 시각화하고, 드래그/키보드로 직접 편집한 뒤
                    솔버에 제출해 결과를 비교합니다. 검증 위반(이격 30m, 시간 겹침, 선석 범위 등)은
                    실시간으로 표시됩니다.
                  </>
                }
              >
                <ScenarioPanel />
              </SectionGroup>
            </Anim>

            <Anim delay={80}>
              <SectionGroup
                id="bpt-workflow"
                icon={Database}
                label="개발자 / 빠른 검증"
                title="BPT 직접 워크플로"
                description={
                  <>
                    풍부 도메인을 우회해 1D <code>BPTRecord</code> 만으로 솔버를 빠르게 검증하는
                    개발자/디버깅 워크플로. 시나리오를 거치지 않고 단일 vessel 부터 작은 묶음까지
                    임의 페이로드를 직접 보낼 수 있습니다.
                  </>
                }
              >
                <Stack gap={5}>
                  <div id="bpt-data">
                    <BptPanel />
                  </div>

                  <div id="bpt-solver">
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
                  </div>

                  <JobsListPanel
                    leftJobId={leftJobId}
                    rightJobId={rightJobId}
                    onSelectLeft={setLeftJobId}
                    onSelectRight={setRightJobId}
                  />

                  <div id="bpt-compare">
                    <ComparePanel leftJobId={leftJobId} rightJobId={rightJobId} />
                  </div>
                </Stack>
              </SectionGroup>
            </Anim>
          </Stack>
        </main>
      </Layout>
    </Page>
  );
}
