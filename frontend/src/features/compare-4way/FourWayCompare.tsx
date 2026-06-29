// 4-way 솔버 결과 비교 — 시나리오 토글 (#1/#2/#3) + CQM/Hybrid/Gurobi/운영자 2×2.
//
// 부스 시연 핵심: 동일 입력 시나리오를 4가지 방법으로 풀었을 때의 결과 비교.
//   - CQM:     D-Wave 양자 어닐러
//   - Hybrid:  D-Wave CQM 초기해 + Gurobi MIP Start 정밀 최적화
//   - Gurobi:  고전 MIP 단독
//   - 운영자:  사람이 수동 작업 (시나리오 #2/#3 의 After_Snapshot)
//
// 각 슬롯:
//   - 상단: 솔버명 + 강조색 + 척수 배지
//   - 메타: 총 체류시간(h) / 계산시간(s) / 위반(건)
//   - 하단: SplitTimeline (presentationMode = 위반 핑크 / 정상 연두)
//
// 데이터:
//   - 시나리오 rows: useUploadedScenarioStore 의 scenario-{1,2,3}-{cqm,hybrid,gurobi,operator}
//   - 메타 (체류시간/계산시간/위반): 보고서 표 4.2 (p.15) + 운영자 측정값

import styled from '@emotion/styled';
import { Cpu, Layers, Pin, PinOff, Sparkles, User } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';

import { usePinnedResults } from '@/features/scenario/pinnedResults';
import { useUploadedScenarioStore } from '@/features/upload/uploadedScenarioStore';
import { validateAssignments } from '@/features/validation/validation';
import type { Assignment } from '@/shared/domain/types';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';

const SplitTimeline = lazy(() =>
  import('@/features/timeline/SplitTimeline').then((m) => ({ default: m.SplitTimeline })),
);

// ---------- styled ----------

const ScenarioPicker = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  background: theme.color.primarySoft,
  border: `1px solid ${theme.color.primary}33`,
  borderRadius: theme.radius.md,
  flexWrap: 'wrap',

  '& .label': {
    fontSize: theme.font.size.xs,
    color: theme.color.primary,
    fontWeight: theme.font.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
  },
}));

const Segmented = styled.div(({ theme }) => ({
  display: 'inline-flex',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',
  background: theme.color.surface,

  '& button': {
    padding: '8px 16px',
    fontSize: theme.font.size.sm,
    background: 'transparent',
    border: 'none',
    color: theme.color.textMuted,
    cursor: 'pointer',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
    fontWeight: theme.font.weight.medium,
  },
  '& button + button': { borderLeft: `1px solid ${theme.color.border}` },
  '& button:hover:not(:disabled)': { background: theme.color.surfaceAlt },
  '& button[data-active="true"]': {
    background: theme.color.primary,
    color: theme.color.textInverse,
    fontWeight: theme.font.weight.semibold,
  },
  '& button:focus-visible': {
    outline: 'none',
    boxShadow: theme.shadow.focus,
    position: 'relative',
    zIndex: 1,
  },
}));

const Grid = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.spacing(3),

  '@media (max-width: 1024px)': {
    gridTemplateColumns: '1fr',
  },
}));

const Card = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  background: theme.color.surface,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

const Head = styled.div<{ accent: string }>(({ theme, accent }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderBottom: `3px solid ${accent}`,
  background: theme.color.surfaceAlt,

  '& .name': {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
  },
  '& .badge': {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    padding: '2px 8px',
    borderRadius: theme.radius.pill,
    background: accent + '22',
    color: accent,
    marginLeft: 'auto',
  },
  '& .pin-btn': {
    padding: 4,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    background: theme.color.surface,
    color: theme.color.textMuted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}, color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
    '&:hover': {
      background: accent + '22',
      color: accent,
      borderColor: accent,
    },
    '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
  },
}));

const Meta = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(1),
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderBottom: `1px solid ${theme.color.borderSubtle}`,
  background: theme.color.bg,

  '& .stat': {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  '& .label': {
    fontSize: 10,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.letter.wide,
  },
  '& .value': {
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    fontFamily: theme.font.mono,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
  },
  '& .value.warn': {
    color: theme.color.danger,
  },
  '& .unit': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    marginLeft: 2,
    fontWeight: theme.font.weight.medium,
  },
}));

const TimelineSlot = styled.div(({ theme }) => ({
  padding: theme.spacing(2),
  minHeight: 420,
}));

// ---------- 데이터 ----------

type ScenarioId = 1 | 2 | 3;
type SolverId = 'cqm' | 'hybrid' | 'gurobi' | 'operator';

interface ScenarioMeta {
  id: ScenarioId;
  label: string;
  /** 입력 시나리오 라벨 (헤더 부연). */
  inputLabel: string;
  /** 척수. */
  vesselCount: number;
}

const SCENARIOS: ScenarioMeta[] = [
  { id: 1, label: '시나리오 #1', inputLabel: 'BPT_Result · 일반 운영', vesselCount: 62 },
  { id: 2, label: '시나리오 #2', inputLabel: 'Before 0313 14:30 · 낮시간 혼잡', vesselCount: 58 },
  { id: 3, label: '시나리오 #3', inputLabel: 'Before 0316 08:00 · 크레인 부족', vesselCount: 58 },
];

interface SolverVisual {
  id: SolverId;
  name: string;
  accent: string;
  icon: typeof Cpu;
}

const SOLVER_VISUAL: Record<SolverId, SolverVisual> = {
  cqm: { id: 'cqm', name: 'CQM (양자)', accent: '#7c3aed', icon: Sparkles },
  hybrid: { id: 'hybrid', name: 'Hybrid (양자-고전)', accent: '#0ea5e9', icon: Cpu },
  gurobi: { id: 'gurobi', name: 'Gurobi (고전 MIP)', accent: '#d97706', icon: Layers },
  operator: { id: 'operator', name: '운영자 (수동)', accent: '#dc2626', icon: User },
};

interface SolverMeta {
  /** 총 체류시간 (h). null = 미실시 또는 측정 불가. */
  objective: number | null;
  /** 계산시간 (초). 운영자는 초 단위로 변환된 값 (분 × 60). */
  elapsedSeconds: number | null;
  /** 운영자처럼 "분" 단위로 표시할지. */
  elapsedAsMinutes?: boolean;
  /** BPTC 측 실제 데이터 없음 — EmptyState 표시. */
  noData?: boolean;
  /** 솔버가 풀이에 실패함 — EmptyState ('실패') 표시. */
  failed?: boolean;
}

/**
 * 시나리오별 솔버 메타. 보고서 표 4.2 (page 15) 의 obj/elapsed 수치.
 * 위반 건수는 메타 정적값 X — 각 슬롯의 rows 를 validateAssignments() 로 동적 계산.
 *
 * 운영자 시간은 Before → After 의 wall-clock 차이.
 */
const META: Record<ScenarioId, Record<SolverId, SolverMeta>> = {
  1: {
    cqm: { objective: 1545, elapsedSeconds: 4290 },
    hybrid: { objective: 1048, elapsedSeconds: 3711 },
    // Gurobi: 시나리오 #1 은 Gurobi 풀이 실패 (시간 초과 / 해 없음).
    gurobi: { objective: null, elapsedSeconds: null, failed: true },
    // 운영자: 시나리오 #1 의 운영자 결과는 BPTC 측 실제 데이터 없음.
    operator: { objective: null, elapsedSeconds: null, noData: true },
  },
  2: {
    cqm: { objective: 1273, elapsedSeconds: 3410 },
    hybrid: { objective: 1046, elapsedSeconds: 2820 },
    gurobi: { objective: 1029, elapsedSeconds: 2790 },
    // After 0313 16:10 = Before 14:30 + 1h 40min = 100분 = 6000s
    operator: { objective: null, elapsedSeconds: 6000, elapsedAsMinutes: true },
  },
  3: {
    cqm: { objective: 1194, elapsedSeconds: 2145 },
    hybrid: { objective: 1047, elapsedSeconds: 1843 },
    gurobi: { objective: 1108, elapsedSeconds: 1806 },
    // After 0316 10:06 = Before 08:00 + 2h 6min = 126분 = 7560s
    operator: { objective: null, elapsedSeconds: 7560, elapsedAsMinutes: true },
  },
};

/**
 * rows 에서 검증 위반 row 수 계산 — SplitTimeline 의 presentationMode 가
 * 빨갛게 칠한 row 수와 정확히 일치하도록 unique rowId 셋의 크기.
 * (issue 수 X — clearance 한 건이 두 척을 빨갛게 하므로 issue 수와 row 수 다름.)
 */
function countViolations(rows: Assignment[]): number {
  if (rows.length === 0) return 0;
  const issues = validateAssignments(rows);
  const set = new Set<string>();
  for (const it of issues) {
    for (const id of it.rowIds) set.add(id);
  }
  return set.size;
}

const SOLVERS: SolverId[] = ['cqm', 'hybrid', 'gurobi', 'operator'];

function formatObjective(meta: SolverMeta): { value: string; unit: string } {
  if (meta.noData || meta.failed || meta.objective == null) return { value: '–', unit: '' };
  return { value: meta.objective.toLocaleString(), unit: 'h' };
}

function formatElapsed(meta: SolverMeta): { value: string; unit: string } {
  if (meta.noData || meta.failed || meta.elapsedSeconds == null) return { value: '–', unit: '' };
  if (meta.elapsedAsMinutes) {
    const min = Math.round(meta.elapsedSeconds / 60);
    return { value: String(min), unit: '분' };
  }
  return { value: String(meta.elapsedSeconds), unit: 's' };
}

// ---------- 컴포넌트 ----------

export function FourWayCompare() {
  const scenarios = useUploadedScenarioStore((s) => s.scenarios);
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const pinnedIds = usePinnedResults((s) => s.pinned);
  const togglePin = usePinnedResults((s) => s.toggle);

  const [activeId, setActiveId] = useState<ScenarioId>(1);

  const anyRegistered = scenarios.some((s) => s.id.startsWith('scenario-'));
  if (!anyRegistered) {
    return (
      <EmptyState
        icon={Cpu}
        title="4-way 비교 데이터가 아직 로드되지 않았습니다"
        description={
          <>
            데모 시나리오가 자동 등록되면 4-way 비교가 여기 표시됩니다. 페이지 새로고침 후에도
            안 보이면 브라우저 콘솔에서 <code>[demo] register fail</code> 메시지 확인.
          </>
        }
      />
    );
  }

  const active = SCENARIOS.find((s) => s.id === activeId)!;
  const activeMeta = META[activeId];

  return (
    <Stack gap={3}>
      <ScenarioPicker role="group" aria-label="시나리오 선택">
        <span className="label">시나리오</span>
        <Segmented>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              data-active={activeId === s.id}
              onClick={() => setActiveId(s.id)}
              title={s.inputLabel}
            >
              {s.label}
            </button>
          ))}
        </Segmented>
        <span style={{ fontSize: 13, color: 'currentColor', opacity: 0.85 }}>
          {active.inputLabel} ({active.vesselCount}척)
        </span>
      </ScenarioPicker>

      <Grid>
        {SOLVERS.map((solverId) => {
          const v = SOLVER_VISUAL[solverId];
          const m = activeMeta[solverId];
          const slice = byId.get(`scenario-${activeId}-${solverId}`);
          const rows = slice?.rows ?? [];
          const obj = formatObjective(m);
          const el = formatElapsed(m);
          // 위반 — META 정적값 X, validateAssignments() 동적 계산. noData/failed 셀은 0.
          const violations = m.noData || m.failed ? 0 : countViolations(rows);
          const Icon = v.icon;
          const pinnedId = `scenario-${activeId}-${solverId}`;
          const isPinned = pinnedIds.includes(pinnedId);
          return (
            <Card key={solverId}>
              <Head accent={v.accent}>
                <Icon size={20} aria-hidden="true" color={v.accent} />
                <span className="name">{v.name}</span>
                <span className="badge">{rows.length}척</span>
                {!m.noData && !m.failed && rows.length > 0 && (
                  <button
                    type="button"
                    className="pin-btn"
                    onClick={() => togglePin(pinnedId)}
                    aria-label={isPinned ? '시나리오 pill 에서 제거' : '시나리오 pill 에 추가'}
                    title={
                      isPinned
                        ? '시나리오 pill 에서 제거 — 더 이상 편집/검증/비교 탭에서 안 보임'
                        : '시나리오 pill 에 추가 — 편집/검증/비교 탭으로 가져옴'
                    }
                  >
                    {isPinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
                  </button>
                )}
              </Head>
              <Meta>
                <div className="stat">
                  <span className="label">총 체류시간</span>
                  <span className="value">
                    {obj.value}
                    {obj.unit && <span className="unit">{obj.unit}</span>}
                  </span>
                </div>
                <div className="stat">
                  <span className="label">계산시간</span>
                  <span className="value">
                    {el.value}
                    {el.unit && <span className="unit">{el.unit}</span>}
                  </span>
                </div>
                <div className="stat">
                  <span className="label">위반</span>
                  <span className={`value ${violations > 0 ? 'warn' : ''}`}>
                    {violations}
                    <span className="unit">건</span>
                  </span>
                </div>
              </Meta>
              <TimelineSlot>
                {m.noData ? (
                  <EmptyState
                    icon={Cpu}
                    title="해당 데이터 없음"
                    description="BPTC 측 실제 데이터가 없습니다."
                  />
                ) : m.failed ? (
                  <EmptyState
                    icon={Cpu}
                    title="풀이 실패"
                    description={`${v.name} 솔버가 해당 시나리오 풀이에 실패했습니다.`}
                  />
                ) : rows.length === 0 ? (
                  <EmptyState
                    icon={Cpu}
                    title="데이터 로드 중"
                    description="자동 등록이 끝나면 표시됩니다. 새로고침 시도하세요."
                  />
                ) : (
                  <Suspense fallback={<Skeleton height={380} radius="md" />}>
                    <SplitTimeline assignments={rows} height={380} presentationMode />
                  </Suspense>
                )}
              </TimelineSlot>
            </Card>
          );
        })}
      </Grid>
    </Stack>
  );
}
