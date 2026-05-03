import styled from '@emotion/styled';
import { ArrowDownAZ, ArrowUpZA, RotateCcw, Search } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/shared/ui/Button';
import { Stack } from '@/shared/ui/Stack';
import type { Assignment } from '@/shared/domain/types';

import {
  DEFAULT_FILTER,
  dataDateRange,
  isFilterActive,
  uniqueRoutes,
  type SearchFilter,
  type SortKey,
  type TerminalFilter,
} from './searchFilter';

const Wrap = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.spacing(3),
  background: theme.color.surface,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  fontSize: theme.font.size.sm,
  fontWeight: theme.font.weight.semibold,
  color: theme.color.textMuted,
  letterSpacing: theme.font.letter.tight,

  '& .count': {
    marginLeft: 'auto',
    fontFamily: theme.font.mono,
    color: theme.color.text,
  },
  '& .reset': { marginLeft: 'auto' },
}));

const Row = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(3),
  flexWrap: 'wrap',

  '& .label': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.letter.wide,
    minWidth: 56,
  },
}));

const Segmented = styled.div(({ theme }) => ({
  display: 'inline-flex',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',

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
  '& button:hover': { background: theme.color.surfaceAlt },
  '& button[data-active="true"]': {
    background: theme.color.primarySoft,
    color: theme.color.primary,
    fontWeight: theme.font.weight.semibold,
  },
  '& button:focus-visible': {
    outline: 'none',
    boxShadow: theme.shadow.focus,
    position: 'relative',
    zIndex: 1,
  },
}));

const ChipsWrap = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  flex: 1,
  minWidth: 200,
}));

const Chip = styled('button', {
  shouldForwardProp: (p) => p !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  padding: '3px 9px',
  fontSize: theme.font.size.xs,
  fontFamily: theme.font.mono,
  fontWeight: active ? theme.font.weight.semibold : theme.font.weight.regular,
  border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
  background: active ? theme.color.primarySoft : theme.color.surface,
  color: active ? theme.color.primary : theme.color.textMuted,
  borderRadius: theme.radius.pill,
  cursor: 'pointer',
  transition: `all ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  '&:hover': { background: active ? theme.color.primarySoftHover : theme.color.surfaceAlt },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

const DateInput = styled.input(({ theme }) => ({
  padding: '5px 8px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  fontSize: theme.font.size.sm,
  fontFamily: theme.font.mono,
  background: theme.color.surface,
  color: theme.color.text,
  '&:focus-visible': {
    outline: 'none',
    borderColor: theme.color.primary,
    boxShadow: theme.shadow.focus,
  },
}));

const SortRow = styled.div(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'start', label: '시작' },
  { key: 'end', label: '종료' },
  { key: 'berth', label: '선석' },
  { key: 'voyage', label: '모선항차' },
];

interface Props {
  /** 시나리오 원본 (route/dateRange 추출용). */
  source: Assignment[];
  filter: SearchFilter;
  onChange: (next: SearchFilter) => void;
  /** 필터 적용 후 통과한 행 수 (헤더 표시용). */
  passedCount: number;
}

export function SearchBar({ source, filter, onChange, passedCount }: Props) {
  const routes = useMemo(() => uniqueRoutes(source), [source]);
  const range = useMemo(() => dataDateRange(source), [source]);

  // <input type="date"> 는 yyyy-mm-dd 만 받음. ISO datetime 의 date 부분만 사용.
  const dateMin = range?.min.slice(0, 10) ?? '';
  const dateMax = range?.max.slice(0, 10) ?? '';
  const dateFromValue = filter.dateFrom?.slice(0, 10) ?? '';
  const dateToValue = filter.dateTo?.slice(0, 10) ?? '';

  function setTerminal(t: TerminalFilter) {
    onChange({ ...filter, terminal: t });
  }

  function toggleRoute(code: string) {
    const next = new Set(filter.routes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange({ ...filter, routes: next });
  }

  function setDateFrom(v: string) {
    onChange({ ...filter, dateFrom: v ? new Date(`${v}T00:00:00`).toISOString() : null });
  }
  function setDateTo(v: string) {
    onChange({ ...filter, dateTo: v ? new Date(`${v}T23:59:59`).toISOString() : null });
  }

  function setSort(key: SortKey) {
    if (filter.sort.key === key) {
      onChange({ ...filter, sort: { key, dir: filter.sort.dir === 'asc' ? 'desc' : 'asc' } });
    } else {
      onChange({ ...filter, sort: { key, dir: 'asc' } });
    }
  }

  function reset() {
    onChange({ ...DEFAULT_FILTER, routes: new Set() });
  }

  return (
    <Wrap role="search" aria-label="시나리오 필터">
      <Header>
        <Search size={14} aria-hidden="true" />
        Search / Filter
        <span className="count">
          {passedCount} / {source.length}
        </span>
        {isFilterActive(filter) && (
          <Button variant="ghost" size="sm" onClick={reset} className="reset">
            <RotateCcw size={12} aria-hidden="true" /> 초기화
          </Button>
        )}
      </Header>

      <Row>
        <span className="label">터미널</span>
        <Segmented role="radiogroup" aria-label="터미널 필터">
          {(['ALL', 'SND', 'GAM'] as TerminalFilter[]).map((t) => (
            <button
              type="button"
              key={t}
              role="radio"
              aria-checked={filter.terminal === t}
              data-active={filter.terminal === t}
              onClick={() => setTerminal(t)}
            >
              {t === 'ALL' ? '전체' : t}
            </button>
          ))}
        </Segmented>
      </Row>

      <Row>
        <span className="label">항로</span>
        <ChipsWrap>
          {routes.length === 0 && <span style={{ fontSize: 12, color: '#868e9c' }}>(데이터 없음)</span>}
          {routes.map((r) => {
            const active = filter.routes.has(r);
            return (
              <Chip
                type="button"
                key={r}
                active={active}
                aria-pressed={active}
                onClick={() => toggleRoute(r)}
              >
                {r}
              </Chip>
            );
          })}
        </ChipsWrap>
      </Row>

      <Row>
        <span className="label">기간</span>
        <DateInput
          type="date"
          value={dateFromValue}
          min={dateMin}
          max={dateMax}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="시작 날짜"
        />
        <span style={{ color: '#868e9c' }}>~</span>
        <DateInput
          type="date"
          value={dateToValue}
          min={dateMin}
          max={dateMax}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="종료 날짜"
        />
        {range && (
          <span style={{ fontSize: 11, color: '#868e9c', fontFamily: 'monospace' }}>
            데이터 범위 {dateMin} ~ {dateMax}
          </span>
        )}
      </Row>

      <Row>
        <span className="label">정렬</span>
        <SortRow>
          <Stack direction="row" gap={1} wrap>
            {SORT_OPTIONS.map((o) => {
              const active = filter.sort.key === o.key;
              return (
                <Chip
                  type="button"
                  key={o.key}
                  active={active}
                  aria-pressed={active}
                  onClick={() => setSort(o.key)}
                >
                  {o.label}
                  {active && (
                    <span style={{ marginLeft: 4, display: 'inline-flex', verticalAlign: 'middle' }}>
                      {filter.sort.dir === 'asc' ? (
                        <ArrowDownAZ size={11} aria-label="오름차순" />
                      ) : (
                        <ArrowUpZA size={11} aria-label="내림차순" />
                      )}
                    </span>
                  )}
                </Chip>
              );
            })}
          </Stack>
        </SortRow>
        <SortDirHint>같은 항목 다시 클릭 → 방향 토글</SortDirHint>
      </Row>
    </Wrap>
  );
}

const SortDirHint = styled.span(({ theme }) => ({
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
  fontFamily: theme.font.mono,
}));
