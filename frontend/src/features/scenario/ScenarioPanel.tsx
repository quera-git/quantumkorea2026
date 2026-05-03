import styled from '@emotion/styled';
import { Layers, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ValidationPanel } from '@/features/validation/ValidationPanel';
import { SplitTimeline } from '@/features/timeline/SplitTimeline';
import { Card } from '@/shared/ui/Card';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Stack } from '@/shared/ui/Stack';

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

type View = 'timeline' | 'validation';

export function ScenarioPanel() {
  const [activeId, setActiveId] = useState<string>(SCENARIO_LIST[0]?.id ?? '');
  const [view, setView] = useState<View>('timeline');

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

  return (
    <Card>
      <SectionHeader
        icon={Layers}
        number="05"
        title="풍부 도메인 시각화"
        description="Streamlit 원본 시나리오 (xlsx → JSON 변환). SND(상)/GAM(하) 분할 타임라인 + 검증 결과."
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
          </Stats>
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
            aria-selected={view === 'validation'}
            active={view === 'validation'}
            onClick={() => setView('validation')}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            검증 결과
          </Tab>
        </TabRow>

        {scenario && view === 'timeline' && <SplitTimeline assignments={scenario.rows} />}
        {scenario && view === 'validation' && (
          <ValidationPanel assignments={scenario.rows} />
        )}
      </Stack>
    </Card>
  );
}
