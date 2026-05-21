// 타임라인 색 모드 토글 + Plan Status legend.
//
//   ┌──────────────────────────────────────────────────────────────────────────┐
//   │ 색 기준  [● Status][○ Vessel]   │ ■적하 완료 ■양하 완료 ■크래인배정 ■미배정 │
//   └──────────────────────────────────────────────────────────────────────────┘
//
// - colorBy='status' 일 때만 4색 chip 노출. voyage 모드일 땐 hint 텍스트로 대체.
// - 분포(distribution) 가 주어지면 각 chip 옆에 count 배지 표시.
// - 다크모드는 ThemeProvider 톤을 그대로 받음.

import styled from '@emotion/styled';
import { Palette } from 'lucide-react';
import { useMemo } from 'react';

import {
  PLAN_STATUS_ORDER,
  planStatusVisual,
  type PlanStatus,
} from '@/shared/domain/statusColors';
import type { Assignment } from '@/shared/domain/types';

import { useColorBy, type ColorByMode } from './colorBy';

const Wrap = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(3),
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  fontSize: theme.font.size.sm,
}));

const Group = styled.div(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const GroupLabel = styled.span(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontSize: theme.font.size.xs,
  fontWeight: theme.font.weight.semibold,
  color: theme.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: theme.font.letter.wide,
}));

const Seg = styled.div(({ theme }) => ({
  display: 'inline-flex',
  padding: 2,
  background: theme.color.surfaceMuted,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.pill,
}));

const SegButton = styled('button', {
  shouldForwardProp: (p) => p !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  padding: '4px 10px',
  border: 'none',
  background: active ? theme.color.surface : 'transparent',
  color: active ? theme.color.text : theme.color.textMuted,
  fontSize: theme.font.size.xs,
  fontWeight: active ? theme.font.weight.semibold : theme.font.weight.regular,
  borderRadius: theme.radius.pill,
  cursor: 'pointer',
  boxShadow: active ? theme.shadow.sm : 'none',
  transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}, color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  '&:hover': {
    color: active ? theme.color.text : theme.color.text,
  },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

const Divider = styled.span(({ theme }) => ({
  width: 1,
  height: 18,
  background: theme.color.border,
}));

const Chips = styled.div(({ theme }) => ({
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
}));

const Chip = styled.span(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: '2px 8px',
  fontSize: theme.font.size.xs,
  color: theme.color.text,
  background: theme.color.surfaceAlt,
  border: `1px solid ${theme.color.borderSubtle}`,
  borderRadius: theme.radius.pill,
}));

const Swatch = styled.span<{ bg: string }>(({ bg }) => ({
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: 3,
  background: bg,
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
}));

const Count = styled.span(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
  marginLeft: 2,
}));

const Hint = styled.span(({ theme }) => ({
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
}));

interface Props {
  /** 색 분포를 표시할 풍부 행. 주면 chip 에 count 배지가 붙음. */
  rows?: Assignment[];
}

/** rows 에서 PlanStatus 분포 집계. null 도 포함. */
function tabulate(rows: Assignment[] | undefined): Map<PlanStatus | 'null', number> {
  const m = new Map<PlanStatus | 'null', number>();
  if (!rows) return m;
  rows.forEach((r) => {
    const k = r.planStatus ?? 'null';
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return m;
}

export function StatusLegend({ rows }: Props) {
  const mode = useColorBy((s) => s.mode);
  const setMode = useColorBy((s) => s.set);
  const dist = useMemo(() => tabulate(rows), [rows]);
  const hasAnyStatus = useMemo(
    () => PLAN_STATUS_ORDER.some((s) => (dist.get(s) ?? 0) > 0),
    [dist],
  );

  return (
    <Wrap role="region" aria-label="타임라인 색 기준">
      <Group>
        <GroupLabel>
          <Palette size={12} aria-hidden="true" />색 기준
        </GroupLabel>
        <Seg role="tablist" aria-label="색 분류 기준">
          {(['status', 'voyage'] as ColorByMode[]).map((m) => (
            <SegButton
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              active={mode === m}
              onClick={() => setMode(m)}
              title={m === 'status' ? 'BPTC 진행 상태별 색' : '모선항차별 식별 색 (해시)'}
            >
              {m === 'status' ? 'Status' : 'Vessel'}
            </SegButton>
          ))}
        </Seg>
      </Group>

      <Divider aria-hidden="true" />

      {mode === 'status' ? (
        <Chips aria-label="Plan Status legend">
          {PLAN_STATUS_ORDER.map((s) => {
            const v = planStatusVisual(s);
            const n = dist.get(s) ?? 0;
            return (
              <Chip key={s} title={v.label}>
                <Swatch bg={v.swatch} aria-hidden="true" />
                {v.label}
                {rows && <Count>{n}</Count>}
              </Chip>
            );
          })}
          {rows && (dist.get('null') ?? 0) > 0 && (
            <Chip title="BPTC 그래픽 미게재 / 정적 시나리오">
              <Swatch bg={planStatusVisual(null).swatch} aria-hidden="true" />
              미지정
              <Count>{dist.get('null')}</Count>
            </Chip>
          )}
          {!hasAnyStatus && rows && rows.length > 0 && (
            <Hint>· 모든 행이 미지정 상태 (라이브 시나리오에서 plan_cd 가 들어오면 활성화)</Hint>
          )}
        </Chips>
      ) : (
        <Hint>모선항차 해시 색 — 같은 항차는 같은 색.</Hint>
      )}
    </Wrap>
  );
}
