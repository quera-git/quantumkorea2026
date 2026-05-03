import styled from '@emotion/styled';
import { GitCommitHorizontal, Layers, Move, ShieldCheck } from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

import { AuditPanel } from '@/features/audit/AuditPanel';
import { EditorCanvas } from '@/features/editor/EditorCanvas';
import { useEditorStore } from '@/features/editor/editor.store';
import { SelectedVesselPanel } from '@/features/editor/SelectedVesselPanel';
import { SearchBar } from '@/features/search/SearchBar';
import { DEFAULT_FILTER, applyFilter, type SearchFilter } from '@/features/search/searchFilter';
import { ValidationPanel } from '@/features/validation/ValidationPanel';
import { Card } from '@/shared/ui/Card';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';

// Plotly 가 들어간 차트는 별도 청크로 분리.
// 사용자가 '타임라인' 탭을 열 때만 plotly basic-dist-min 다운로드 (~1MB).
const SplitTimeline = lazy(() =>
  import('@/features/timeline/SplitTimeline').then((m) => ({ default: m.SplitTimeline })),
);

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

type View = 'timeline' | 'editor' | 'audit' | 'validation';

export function ScenarioPanel() {
  const [activeId, setActiveId] = useState<string>(SCENARIO_LIST[0]?.id ?? '');
  const [view, setView] = useState<View>('timeline');
  const [filter, setFilter] = useState<SearchFilter>({ ...DEFAULT_FILTER, routes: new Set() });

  const scenario = useMemo(() => {
    if (!activeId) return null;
    try {
      return loadScenario(activeId);
    } catch (e) {
      console.error('scenario load failed', e);
      return null;
    }
  }, [activeId]);

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
        <PillRow>
          {SCENARIO_LIST.map((s) => (
            <Pill key={s.id} active={s.id === activeId} onClick={() => setActiveId(s.id)}>
              {s.label}
            </Pill>
          ))}
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
        </TabRow>

        {scenario && view === 'timeline' && (
          <Suspense fallback={<Skeleton height={680} radius="md" />}>
            <SplitTimeline assignments={displayRows} />
          </Suspense>
        )}

        {scenario && view === 'editor' && (
          <EditorGrid>
            <EditorCanvas assignments={editorRows} />
            <SelectedVesselPanel />
          </EditorGrid>
        )}

        {scenario && view === 'audit' && <AuditPanel />}

        {scenario && view === 'validation' && <ValidationPanel assignments={displayRows} />}
      </Stack>
    </Card>
  );
}
