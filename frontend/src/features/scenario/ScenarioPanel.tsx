import styled from '@emotion/styled';
import {
  ArrowLeftRight,
  Cpu,
  GitCommitHorizontal,
  Layers,
  Move,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

import { AuditPanel } from '@/features/audit/AuditPanel';
import { CompareScenarioTab } from '@/features/compare-scenario/CompareScenarioTab';
import { LiveQueryPanel } from '@/features/crawler/LiveQueryPanel';
import { useLiveScenarioStore } from '@/features/crawler/liveScenarioStore';
import { EditorActionsBar } from '@/features/editor/EditorActionsBar';
import { EditorCanvas } from '@/features/editor/EditorCanvas';
import { useEditorStore } from '@/features/editor/editor.store';
import { SelectedVesselPanel } from '@/features/editor/SelectedVesselPanel';
import { SearchBar } from '@/features/search/SearchBar';
import { DEFAULT_FILTER, applyFilter, type SearchFilter } from '@/features/search/searchFilter';
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

import { SCENARIO_LIST, loadScenario } from './scenarioLoader';

const PillRow = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
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

const EditorGrid = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 320px',
  gap: theme.spacing(3),
  alignItems: 'start',
  '@media (max-width: 1024px)': {
    gridTemplateColumns: '1fr',
  },
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

type View = 'timeline' | 'editor' | 'audit' | 'validation' | 'result' | 'compare';

export function ScenarioPanel() {
  const [activeId, setActiveId] = useState<string>(SCENARIO_LIST[0]?.id ?? '');
  const [view, setView] = useState<View>('timeline');
  const [filter, setFilter] = useState<SearchFilter>({ ...DEFAULT_FILTER, routes: new Set() });

  const liveScenario = useLiveScenarioStore((s) => s.current);

  // 시나리오 = 정적 4개 + 라이브 1개(있을 때).
  // 라이브가 있고 activeId 가 그것을 가리키면 메모리 시나리오 사용, 아니면 정적 loader.
  const scenario = useMemo(() => {
    if (!activeId) return null;
    if (liveScenario && activeId === liveScenario.id) {
      return {
        scenarioId: liveScenario.id,
        label: liveScenario.label,
        sourceFile: 'crawler/preview (live)',
        rowCount: liveScenario.rows.length,
        rows: liveScenario.rows,
      };
    }
    try {
      return loadScenario(activeId);
    } catch (e) {
      console.error('scenario load failed', e);
      return null;
    }
  }, [activeId, liveScenario]);

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
        <LiveQueryPanel />

        <PillRow>
          {SCENARIO_LIST.map((s) => (
            <Pill key={s.id} active={s.id === activeId} onClick={() => setActiveId(s.id)}>
              {s.label}
            </Pill>
          ))}
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
        </TabRow>

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
              <SelectedVesselPanel />
            </EditorGrid>
          </Stack>
        )}

        {scenario && view === 'audit' && <AuditPanel />}

        {scenario && view === 'validation' && <ValidationPanel assignments={displayRows} />}

        {scenario && view === 'result' && <ResultView />}

        {scenario && view === 'compare' && (
          <CompareScenarioTab scenarioRows={scenario.rows} />
        )}
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
