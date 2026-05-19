import styled from '@emotion/styled';
import { ArrowLeftRight, Layers } from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

import { AuditPanel } from '@/features/audit/AuditPanel';
import { useEditorStore } from '@/features/editor/editor.store';
import type { Assignment } from '@/shared/domain/types';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';

import {
  SOURCE_META,
  isSourceAvailable,
  rowsForSource,
  type CompareSource,
  type SourceContext,
} from './sources';

const SplitTimeline = lazy(() =>
  import('@/features/timeline/SplitTimeline').then((m) => ({ default: m.SplitTimeline })),
);

const Picker = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(3),
  padding: theme.spacing(3),
  background: theme.color.surfaceAlt,
  borderRadius: theme.radius.md,
  flexWrap: 'wrap',

  '& .label': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.letter.wide,
    minWidth: 36,
  },
  '& .arrow': {
    color: theme.color.textSubtle,
    flexShrink: 0,
  },
}));

const Segmented = styled.div(({ theme }) => ({
  display: 'inline-flex',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',
  background: theme.color.surface,

  '& button': {
    padding: '6px 12px',
    fontSize: theme.font.size.sm,
    background: 'transparent',
    border: 'none',
    color: theme.color.textMuted,
    cursor: 'pointer',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  },
  '& button + button': { borderLeft: `1px solid ${theme.color.border}` },
  '& button:hover:not(:disabled)': { background: theme.color.surfaceAlt },
  '& button[data-active="true"]': {
    background: theme.color.primarySoft,
    color: theme.color.primary,
    fontWeight: theme.font.weight.semibold,
  },
  '& button:disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
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

const SlotCard = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  padding: theme.spacing(3),
  background: theme.color.surface,

  '& .head': {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),

    '& .badge': {
      padding: '2px 8px',
      borderRadius: theme.radius.pill,
      fontSize: theme.font.size.xs,
      fontWeight: theme.font.weight.semibold,
      background: theme.color.primarySoft,
      color: theme.color.primary,
    },
    '& .meta': {
      fontSize: theme.font.size.xs,
      color: theme.color.textSubtle,
      fontFamily: theme.font.mono,
      marginLeft: 'auto',
    },
  },
}));

const SOURCES: CompareSource[] = ['original', 'edited', 'result'];

interface Props {
  /** ScenarioPanel 이 originalRows 를 직접 가져다 줘서 source 해석에 사용. */
  scenarioRows: Assignment[];
}

export function CompareScenarioTab({ scenarioRows }: Props) {
  const currentRows = useEditorStore((s) => s.currentRows);
  const lastResult = useEditorStore((s) => s.lastResult);

  const ctx: SourceContext = useMemo(
    () => ({ originalRows: scenarioRows, currentRows, lastResult }),
    [scenarioRows, currentRows, lastResult],
  );

  const [leftSource, setLeftSource] = useState<CompareSource>('original');
  const [rightSource, setRightSource] = useState<CompareSource>('edited');

  // result 가 사라졌는데 슬롯에서 그걸 보고 있으면 fallback.
  useEffect(() => {
    if (leftSource === 'result' && !lastResult) setLeftSource('original');
    if (rightSource === 'result' && !lastResult) setRightSource('edited');
  }, [lastResult, leftSource, rightSource]);

  const leftRows = rowsForSource(leftSource, ctx) ?? [];
  const rightRows = rowsForSource(rightSource, ctx) ?? [];

  return (
    <Stack gap={4}>
      <Picker role="group" aria-label="비교 슬롯 source 선택">
        <span className="label">좌</span>
        <Segmented>
          {SOURCES.map((s) => {
            const meta = SOURCE_META[s];
            const available = isSourceAvailable(s, ctx);
            return (
              <button
                key={`L-${s}`}
                type="button"
                data-active={leftSource === s}
                onClick={() => setLeftSource(s)}
                disabled={!available}
                title={meta.hint}
              >
                {meta.label}
              </button>
            );
          })}
        </Segmented>
        <ArrowLeftRight size={16} className="arrow" aria-hidden="true" />
        <span className="label">우</span>
        <Segmented>
          {SOURCES.map((s) => {
            const meta = SOURCE_META[s];
            const available = isSourceAvailable(s, ctx);
            return (
              <button
                key={`R-${s}`}
                type="button"
                data-active={rightSource === s}
                onClick={() => setRightSource(s)}
                disabled={!available}
                title={meta.hint}
              >
                {meta.label}
              </button>
            );
          })}
        </Segmented>
      </Picker>

      <Grid>
        <SlotCard>
          <div className="head">
            <span className="badge">{SOURCE_META[leftSource].label}</span>
            <span className="meta">{leftRows.length}척</span>
          </div>
          {leftRows.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={`${SOURCE_META[leftSource].label} 데이터 없음`}
              description={SOURCE_META[leftSource].hint}
            />
          ) : (
            <Suspense fallback={<Skeleton height={520} radius="md" />}>
              <SplitTimeline assignments={leftRows} height={520} />
            </Suspense>
          )}
        </SlotCard>

        <SlotCard>
          <div className="head">
            <span className="badge">{SOURCE_META[rightSource].label}</span>
            <span className="meta">{rightRows.length}척</span>
          </div>
          {rightRows.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={`${SOURCE_META[rightSource].label} 데이터 없음`}
              description={SOURCE_META[rightSource].hint}
            />
          ) : (
            <Suspense fallback={<Skeleton height={520} radius="md" />}>
              <SplitTimeline assignments={rightRows} height={520} />
            </Suspense>
          )}
        </SlotCard>
      </Grid>

      <SlotCard>
        <div className="head">
          <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>
            Diff: {SOURCE_META[leftSource].label} → {SOURCE_META[rightSource].label}
          </span>
        </div>
        {/* AuditPanel 의 props 일반화로 임의 두 source 비교 가능. dirty 는 비교가 의미 있을 때만 true. */}
        <AuditPanel
          original={leftRows}
          current={rightRows}
          isDirty={leftSource !== rightSource && leftRows.length > 0 && rightRows.length > 0}
        />
      </SlotCard>
    </Stack>
  );
}
