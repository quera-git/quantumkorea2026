import styled from '@emotion/styled';
import {
  ArrowLeftRight,
  Cpu,
  GitCommitHorizontal,
  Grid2x2,
  Layers,
  Move,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

import { AuditPanel } from '@/features/audit/AuditPanel';
import { FourWayCompare } from '@/features/compare-4way/FourWayCompare';
import { CompareScenarioTab } from '@/features/compare-scenario/CompareScenarioTab';
import { LiveQueryPanel } from '@/features/crawler/LiveQueryPanel';
import { useLiveScenarioStore } from '@/features/crawler/liveScenarioStore';
import { EditorActionsBar } from '@/features/editor/EditorActionsBar';
import { EditorCanvas } from '@/features/editor/EditorCanvas';
import { useEditorStore } from '@/features/editor/editor.store';
import { SearchBar } from '@/features/search/SearchBar';
import { DEFAULT_FILTER, applyFilter, type SearchFilter } from '@/features/search/searchFilter';
import { UploadButton } from '@/features/upload/UploadButton';
import { env } from '@/shared/config/env';
import { useUploadedScenarioStore } from '@/features/upload/uploadedScenarioStore';
import { ValidationPanel } from '@/features/validation/ValidationPanel';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';
import { useToast } from '@/shared/ui/Toast';

// Plotly 가 들어간 차트는 별도 청크로 분리.
// 사용자가 '타임라인' 탭을 열 때만 plotly basic-dist-min 다운로드 (~1MB).
const SplitTimeline = lazy(() =>
  import('@/features/timeline/SplitTimeline').then((m) => ({ default: m.SplitTimeline })),
);

import { StatusLegend } from '@/features/timeline/StatusLegend';

// 정적 시나리오는 제거됨 — 라이브/업로드만 source. scenarioLoader.ts 는 후방 호환용 stub.

import { usePinnedResults } from './pinnedResults';
import { useAutoRegisterDemo } from './useAutoRegisterDemo';

const PillRow = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  alignItems: 'center',
}));

const Pill = styled('button', {
  shouldForwardProp: (p) => p !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  padding: '6px 12px',
  fontSize: theme.font.size.sm,
  fontWeight: active ? theme.font.weight.semibold : theme.font.weight.regular,
  border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
  background: active ? theme.color.primarySoft : theme.color.surface,
  color: active ? theme.color.primary : theme.color.text,
  borderRadius: theme.radius.pill,
  cursor: 'pointer',
  transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}, color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  '&:hover': { background: active ? theme.color.primarySoft : theme.color.surfaceAlt },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

// 업로드 시나리오 pill — 본체 + 삭제 X 버튼이 inline 으로 붙는 grouped pill.
const UploadedPillGroup = styled.div(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'stretch',
  borderRadius: theme.radius.pill,
  overflow: 'hidden',
  border: `1px solid ${theme.color.border}`,

  '& > button + button': { borderLeft: `1px solid ${theme.color.border}` },
  '& > button': { border: 'none', borderRadius: 0 },
}));

const RemoveButton = styled.button(({ theme }) => ({
  padding: '6px 8px',
  background: theme.color.surface,
  color: theme.color.textMuted,
  cursor: 'pointer',
  fontSize: theme.font.size.sm,
  fontFamily: theme.font.mono,
  lineHeight: 1,
  '&:hover': { background: theme.color.dangerSoft, color: theme.color.danger },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

const Stats = styled.div(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(4),
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  fontFamily: theme.font.mono,
  '& strong': { color: theme.color.text, fontWeight: theme.font.weight.semibold },
  '& .dirty': { color: theme.color.warning, fontWeight: theme.font.weight.semibold },
}));

const TabRow = styled.div(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  borderBottom: `1px solid ${theme.color.border}`,
  marginBottom: theme.spacing(3),
}));

const Tab = styled('button', {
  shouldForwardProp: (p) => p !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  padding: '8px 14px',
  fontSize: theme.font.size.sm,
  fontWeight: active ? theme.font.weight.semibold : theme.font.weight.medium,
  background: 'transparent',
  border: 'none',
  borderBottom: `2px solid ${active ? theme.color.primary : 'transparent'}`,
  color: active ? theme.color.primary : theme.color.textMuted,
  cursor: 'pointer',
  marginBottom: -1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  transition: `color ${theme.motion.duration.fast} ${theme.motion.easing.standard}, border-color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  '&:hover': { color: theme.color.text },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

// 단일 컬럼 — vessel detail panel 은 Dashboard 좌측 LeftRail 로 이동.
const EditorGrid = styled.div(() => ({
  display: 'block',
}));

const ResultDot = styled.span(({ theme }) => ({
  display: 'inline-block',
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: theme.color.success,
  marginLeft: 2,
}));

const ResultMeta = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),

  '& .stat': {
    padding: theme.spacing(3),
    background: theme.color.surfaceAlt,
    borderRadius: theme.radius.md,
  },
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
    fontFamily: theme.font.mono,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
  },
  '& .small': {
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    color: theme.color.textSubtle,
    wordBreak: 'break-all',
  },
}));

type View = 'timeline' | 'editor' | 'audit' | 'validation' | 'result' | 'compare' | 'compare4way';

export function ScenarioPanel() {
  // 부스 데모 자동 등록 — 첫 진입 + uploadedScenarios 비어있을 때만 동작.
  useAutoRegisterDemo();

  const [activeId, setActiveId] = useState<string>('');
  const [view, setView] = useState<View>('timeline');
  const [filter, setFilter] = useState<SearchFilter>({ ...DEFAULT_FILTER, routes: new Set() });

  const liveScenario = useLiveScenarioStore((s) => s.current);
  const allUploadedScenarios = useUploadedScenarioStore((s) => s.scenarios);
  const pinnedResultIds = usePinnedResults((s) => s.pinned);

  // pill 행에는 입력/사용자 업로드 시나리오 + 사용자가 4-way 탭에서 핀한 결과들.
  // 데모 솔버 결과 (scenario-{1,2,3}-{cqm|hybrid|gurobi|operator}) 12개는 기본 hidden —
  // 4-way 비교 탭이 자동 lookup 으로 사용 (auto-register 가 store 에 박아둠).
  // 시나리오 lookup 등 store 접근은 allUploadedScenarios 그대로 사용.
  const uploadedScenarios = useMemo(() => {
    const pinnedSet = new Set(pinnedResultIds);
    return allUploadedScenarios.filter((s) => {
      const isDemoResult = /^scenario-[1-3]-(cqm|hybrid|gurobi|operator)$/.test(s.id);
      // 입력/사용자 업로드 시나리오는 항상 노출. 데모 결과는 pinned 된 것만.
      if (!isDemoResult) return true;
      return pinnedSet.has(s.id);
    });
  }, [allUploadedScenarios, pinnedResultIds]);
  const removeUploaded = useUploadedScenarioStore((s) => s.remove);

  // 시나리오 = 라이브 1개(있을 때) + 업로드 N개. 정적 시나리오는 제거됨.
  // 우선순위: 업로드 > 라이브 (id 충돌 시).
  const scenario = useMemo(() => {
    if (!activeId) return null;
    const uploaded = uploadedScenarios.find((s) => s.id === activeId);
    if (uploaded) {
      return {
        scenarioId: uploaded.id,
        label: uploaded.label,
        sourceFile: uploaded.sourceFile,
        rowCount: uploaded.rows.length,
        rows: uploaded.rows,
      };
    }
    if (liveScenario && activeId === liveScenario.id) {
      return {
        scenarioId: liveScenario.id,
        label: liveScenario.label,
        sourceFile: 'crawler/preview (live)',
        rowCount: liveScenario.rows.length,
        rows: liveScenario.rows,
      };
    }
    return null;
  }, [activeId, liveScenario, uploadedScenarios]);

  // 자동 선택 — activeId 가 비어있는데 라이브 또는 업로드가 있으면 첫 번째로 선택.
  useEffect(() => {
    if (activeId) return;
    if (uploadedScenarios.length > 0) {
      setActiveId(uploadedScenarios[0]!.id);
    } else if (liveScenario) {
      setActiveId(liveScenario.id);
    }
  }, [activeId, liveScenario, uploadedScenarios]);

  const stats = useMemo(() => {
    if (!scenario) return null;
    const sndCount = scenario.rows.filter((r) => r.terminal === 'SND').length;
    const gamCount = scenario.rows.filter((r) => r.terminal === 'GAM').length;
    return { total: scenario.rows.length, sndCount, gamCount };
  }, [scenario]);

  // 에디터 상태 — editor tab 진입 시 또는 시나리오 변경 시 snapshot 로드.
  const loadSnapshot = useEditorStore((s) => s.loadSnapshot);
  const editorScenarioId = useEditorStore((s) => s.scenarioId);
  const editorRows = useEditorStore((s) => s.currentRows);
  const isDirty = useEditorStore((s) => s.isDirty());
  const lastResult = useEditorStore((s) => s.lastResult);

  useEffect(() => {
    if (!scenario) return;
    if (editorScenarioId !== scenario.scenarioId) {
      loadSnapshot(scenario.scenarioId, scenario.rows);
    }
  }, [scenario, editorScenarioId, loadSnapshot]);

  // 시나리오 변경 시 필터 초기화 (route 셋이 다른 시나리오에서 의미 없음).
  useEffect(() => {
    setFilter({ ...DEFAULT_FILTER, routes: new Set() });
  }, [activeId]);

  // 검증/타임라인/Audit 표시 데이터:
  //   - 에디터에 dirty 가 있으면 currentRows 사용 (편집 반영).
  //   - 그 외엔 원본 시나리오 rows.
  // 둘 다 SearchBar 필터를 통과시킨 후 표시.
  const baseRows = useMemo(() => {
    if (!scenario) return [];
    if (editorScenarioId === scenario.scenarioId && editorRows.length > 0) {
      return editorRows;
    }
    return scenario.rows;
  }, [scenario, editorScenarioId, editorRows]);

  const displayRows = useMemo(() => applyFilter(baseRows, filter), [baseRows, filter]);

  return (
    <Card>
      <SectionHeader
        icon={Layers}
        number="05"
        title="풍부 도메인 시각화 + 편집"
        description="Streamlit 원본 시나리오 기반 SND/GAM 분할 타임라인 + 드래그 에디터 + 실시간 검증."
      />

      <Stack gap={4}>
        {!env.demoMode && <LiveQueryPanel />}

        <PillRow>
          {liveScenario && (
            <Pill
              active={activeId === liveScenario.id}
              onClick={() => setActiveId(liveScenario.id)}
              data-live="true"
              style={{ borderStyle: 'dashed' }}
            >
              🔴 {liveScenario.label}
            </Pill>
          )}
          {uploadedScenarios.map((s) => (
            <UploadedPillGroup key={s.id}>
              <Pill
                active={s.id === activeId}
                onClick={() => setActiveId(s.id)}
                title={`${s.sourceFile} · ${s.rows.length}척 · ${s.format}`}
              >
                📎 {s.label}
              </Pill>
              <RemoveButton
                onClick={() => {
                  if (!window.confirm(`업로드 시나리오 "${s.label}" 을 삭제할까요?`)) return;
                  removeUploaded(s.id);
                  // 삭제한 게 활성 시나리오면 선택 해제 → 자동 선택 effect 가 다른 후보로 이동.
                  if (s.id === activeId) setActiveId('');
                }}
                aria-label={`${s.label} 시나리오 삭제`}
                title="삭제"
              >
                ×
              </RemoveButton>
            </UploadedPillGroup>
          ))}
          <UploadButton onAdded={(id) => setActiveId(id)} />
        </PillRow>

        {stats && (
          <Stats>
            <span>
              총 <strong>{stats.total}</strong>척
            </span>
            <span>
              SND <strong>{stats.sndCount}</strong>
            </span>
            <span>
              GAM <strong>{stats.gamCount}</strong>
            </span>
            {scenario && <span>scenarioId={scenario.scenarioId}</span>}
            {isDirty && <span className="dirty">● 편집됨</span>}
          </Stats>
        )}

        {scenario && (
          <SearchBar
            source={baseRows}
            filter={filter}
            onChange={setFilter}
            passedCount={displayRows.length}
          />
        )}

        <TabRow role="tablist">
          <Tab
            type="button"
            role="tab"
            aria-selected={view === 'timeline'}
            active={view === 'timeline'}
            onClick={() => setView('timeline')}
          >
            <Layers size={14} aria-hidden="true" />
            타임라인
          </Tab>
          <Tab
            type="button"
            role="tab"
            aria-selected={view === 'editor'}
            active={view === 'editor'}
            onClick={() => setView('editor')}
          >
            <Move size={14} aria-hidden="true" />
            편집
          </Tab>
          <Tab
            type="button"
            role="tab"
            aria-selected={view === 'audit'}
            active={view === 'audit'}
            onClick={() => setView('audit')}
          >
            <GitCommitHorizontal size={14} aria-hidden="true" />
            Audit
          </Tab>
          <Tab
            type="button"
            role="tab"
            aria-selected={view === 'validation'}
            active={view === 'validation'}
            onClick={() => setView('validation')}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            검증 결과
          </Tab>
          <Tab
            type="button"
            role="tab"
            aria-selected={view === 'result'}
            active={view === 'result'}
            onClick={() => setView('result')}
          >
            <Cpu size={14} aria-hidden="true" />
            솔버 결과
            {lastResult && <ResultDot aria-label="결과 있음" />}
          </Tab>
          <Tab
            type="button"
            role="tab"
            aria-selected={view === 'compare'}
            active={view === 'compare'}
            onClick={() => setView('compare')}
          >
            <ArrowLeftRight size={14} aria-hidden="true" />
            비교
          </Tab>
          <Tab
            type="button"
            role="tab"
            aria-selected={view === 'compare4way'}
            active={view === 'compare4way'}
            onClick={() => setView('compare4way')}
            title="CQM · Hybrid · Gurobi · 운영자 4가지 결과 한 화면 비교"
          >
            <Grid2x2 size={14} aria-hidden="true" />
            4-way 비교
          </Tab>
        </TabRow>

        {!scenario && (
          <EmptyState
            icon={Layers}
            title="시나리오가 없습니다"
            description={
              <>
                위의 <strong>라이브 BPTC</strong> 패널에서 실시간 데이터를 불러오거나,
                <strong> 시나리오 업로드</strong> 버튼으로 .xlsx / .json 파일을 등록하세요.
                형식이 궁금하면 <strong>"예시"</strong> 메뉴에서 샘플을 다운로드할 수 있습니다.
              </>
            }
          />
        )}

        {scenario && view === 'timeline' && (
          <Stack gap={3}>
            <StatusLegend rows={displayRows} />
            <Suspense fallback={<Skeleton height={680} radius="md" />}>
              <SplitTimeline assignments={displayRows} />
            </Suspense>
          </Stack>
        )}

        {scenario && view === 'editor' && (
          <Stack gap={3}>
            <EditorActionsBar />
            <StatusLegend rows={editorRows} />
            <EditorGrid>
              <EditorCanvas assignments={editorRows} />
            </EditorGrid>
          </Stack>
        )}

        {scenario && view === 'audit' && <AuditPanel />}

        {scenario && view === 'validation' && <ValidationPanel assignments={displayRows} />}

        {scenario && view === 'result' && <ResultView />}

        {scenario && view === 'compare' && (
          <CompareScenarioTab scenarioRows={scenario.rows} />
        )}

        {/* 4-way 비교는 시나리오 활성과 무관하게 항상 노출 — 데모 자동 등록된
            결과(result-cqm/hybrid/gurobi/operator)를 자체적으로 lookup. */}
        {view === 'compare4way' && <FourWayCompare />}
      </Stack>
    </Card>
  );
}

function ResultView() {
  const lastResult = useEditorStore((s) => s.lastResult);
  const clearResult = useEditorStore((s) => s.clearResult);
  const replaceCurrentRows = useEditorStore((s) => s.replaceCurrentRows);
  const [loadConfirmOpen, setLoadConfirmOpen] = useState(false);
  const toast = useToast();

  if (!lastResult) {
    return (
      <EmptyState
        icon={Cpu}
        title="아직 솔버 결과가 없습니다"
        description="편집 탭에서 '원본 → 솔버' 또는 '편집본 → 솔버' 를 눌러 솔버를 돌리면 stitch 된 결과가 여기에 표시됩니다."
      />
    );
  }

  function loadIntoEditor() {
    if (!lastResult) return;
    replaceCurrentRows(lastResult.rows);
    setLoadConfirmOpen(false);
    toast.notify({
      tone: 'success',
      title: '솔버 결과를 편집기로 불러왔습니다',
      description: `${lastResult.rows.length}척이 currentRows 로 교체됨. 편집 탭에서 위에 직접 수정하세요.`,
    });
  }

  return (
    <Stack gap={3}>
      <ResultMeta>
        <div className="stat">
          <div className="label">solver</div>
          <div className="value">{lastResult.solver.toUpperCase()}</div>
        </div>
        <div className="stat">
          <div className="label">objective</div>
          <div className="value">{lastResult.objectiveValue?.toFixed(2) ?? '-'}</div>
        </div>
        <div className="stat">
          <div className="label">elapsed</div>
          <div className="value">
            {lastResult.elapsedSeconds != null
              ? `${lastResult.elapsedSeconds.toFixed(1)}s`
              : '-'}
          </div>
        </div>
        <div className="stat">
          <div className="label">stitched rows</div>
          <div className="value">{lastResult.rows.length}</div>
        </div>
        <div className="stat">
          <div className="label">unmatched</div>
          <div className="value" style={lastResult.unmatched.length ? { color: '#dc2626' } : undefined}>
            {lastResult.unmatched.length}
          </div>
        </div>
        <div className="stat">
          <div className="label">job_id</div>
          <div className="small">{lastResult.jobId}</div>
        </div>
      </ResultMeta>
      <Suspense fallback={<Skeleton height={680} radius="md" />}>
        <SplitTimeline assignments={lastResult.rows} />
      </Suspense>
      <Stack direction="row" gap={2} wrap>
        <Button onClick={() => setLoadConfirmOpen(true)}>
          <Wand2 size={14} aria-hidden="true" /> 이 결과를 편집기로 불러오기
        </Button>
        <Button variant="ghost" size="sm" onClick={clearResult}>
          결과 비우기
        </Button>
      </Stack>

      <ConfirmDialog
        open={loadConfirmOpen}
        title="솔버 결과를 편집기로 불러오기"
        description={
          <>
            현재 편집 중인 행들이 솔버가 제안한 결과로 <strong>교체</strong>됩니다. 그 위에서
            추가 수정 가능 (Undo 로 되돌릴 수 있음). 원본 시나리오는 그대로 보존됩니다.
          </>
        }
        detail={
          <>
            교체될 행 수 = <strong>{lastResult.rows.length}</strong>척
            <br />
            솔버 = <strong>{lastResult.solver.toUpperCase()}</strong> · obj ={' '}
            {lastResult.objectiveValue?.toFixed(2) ?? '-'}
          </>
        }
        confirmLabel="불러오기"
        cancelLabel="취소"
        onConfirm={loadIntoEditor}
        onCancel={() => setLoadConfirmOpen(false)}
      />
    </Stack>
  );
}
