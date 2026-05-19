import styled from '@emotion/styled';
import { Download, GitCommitHorizontal, Sparkles } from 'lucide-react';
import { useMemo } from 'react';

import { useEditorStore } from '@/features/editor/editor.store';
import type { Assignment } from '@/shared/domain/types';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Stack } from '@/shared/ui/Stack';
import { useToast } from '@/shared/ui/Toast';

import {
  diffRows,
  diffsToCsv,
  summarize,
  type AuditField,
  type ChangedField,
  type RowDiff,
} from './audit';

const FIELD_LABEL: Record<AuditField, string> = {
  terminal: '터미널',
  berth: '선석',
  start: '시작',
  end: '종료',
  f: 'f(앞)',
  e: 'e(뒤)',
  y_m: 'y_mid',
};

const Wrap = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const SummaryGrid = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: theme.spacing(2),
}));

const Stat = styled.div<{ tone: 'neutral' | 'primary' | 'warning' | 'ok' }>(
  ({ theme, tone }) => {
    const palette = {
      neutral: { bg: theme.color.surfaceAlt, fg: theme.color.text },
      primary: { bg: theme.color.primarySoft, fg: theme.color.primary },
      warning: { bg: theme.color.warningSoft, fg: theme.color.warning },
      ok: { bg: theme.color.successSoft, fg: theme.color.success },
    }[tone];
    return {
      padding: theme.spacing(3),
      background: palette.bg,
      borderRadius: theme.radius.md,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      '& .label': {
        fontSize: theme.font.size.xs,
        color: palette.fg,
        textTransform: 'uppercase',
        fontWeight: theme.font.weight.semibold,
        letterSpacing: theme.font.letter.wide,
      },
      '& .value': {
        fontSize: theme.font.size.xl,
        fontWeight: theme.font.weight.bold,
        color: palette.fg,
        fontFamily: theme.font.mono,
        letterSpacing: theme.font.letter.tight,
      },
      '& .unit': {
        fontSize: theme.font.size.sm,
        color: palette.fg,
        opacity: 0.65,
      },
    };
  },
);

const Table = styled.table(({ theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: theme.font.size.sm,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',

  thead: {
    background: theme.color.surfaceAlt,
  },
  th: {
    fontWeight: theme.font.weight.semibold,
    color: theme.color.textMuted,
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.color.border}`,
    whiteSpace: 'nowrap',
    fontSize: theme.font.size.xs,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
  },
  td: {
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.color.borderSubtle}`,
    verticalAlign: 'top',
  },
  'tr.row-head td': {
    background: theme.color.surface,
    fontWeight: theme.font.weight.medium,
  },
  'tr.field-row td': {
    paddingTop: 4,
    paddingBottom: 4,
  },
  'tbody tr:last-of-type td': {
    borderBottom: 'none',
  },
  '.mono': {
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
  },
  '.delta-pos': {
    color: theme.color.success,
    fontFamily: theme.font.mono,
    fontWeight: theme.font.weight.semibold,
  },
  '.delta-neg': {
    color: theme.color.danger,
    fontFamily: theme.font.mono,
    fontWeight: theme.font.weight.semibold,
  },
  '.delta-zero': {
    color: theme.color.textSubtle,
    fontFamily: theme.font.mono,
  },
}));

function renderDelta(value: number, unit: string): JSX.Element {
  const cls = value > 0 ? 'delta-pos' : value < 0 ? 'delta-neg' : 'delta-zero';
  const sign = value > 0 ? '+' : '';
  return (
    <span className={cls}>
      {sign}
      {value}
      {unit}
    </span>
  );
}

function renderCellValue(c: ChangedField, side: 'before' | 'after'): string {
  const v = side === 'before' ? c.before : c.after;
  if (v == null) return '-';
  if (c.field === 'start' || c.field === 'end') {
    return String(v).replace('T', ' ').slice(0, 16);
  }
  return String(v);
}

interface AuditPanelProps {
  /** 비교 기준(=before). 미지정 시 editor store 의 originalRows. */
  original?: Assignment[];
  /** 비교 대상(=after). 미지정 시 editor store 의 currentRows. */
  current?: Assignment[];
  /** "원본과 동일" 표시 여부. 미지정 시 editor store 의 dirty 로 추론. */
  isDirty?: boolean;
}

export function AuditPanel({
  original: originalProp,
  current: currentProp,
  isDirty: isDirtyProp,
}: AuditPanelProps = {}) {
  // props 가 들어오면 그것 우선, 아니면 editor store fallback.
  const storeOriginal = useEditorStore((s) => s.originalRows);
  const storeCurrent = useEditorStore((s) => s.currentRows);
  const storeDirty = useEditorStore((s) => s.isDirty());

  const original = originalProp ?? storeOriginal;
  const current = currentProp ?? storeCurrent;
  const isDirty = isDirtyProp ?? storeDirty;

  const toast = useToast();

  const diffs: RowDiff[] = useMemo(() => diffRows(original, current), [original, current]);
  const summary = useMemo(() => summarize(diffs), [diffs]);

  function handleExport() {
    if (diffs.length === 0) {
      toast.notify({ tone: 'info', title: '내보낼 변경 사항이 없습니다' });
      return;
    }
    const csv = diffsToCsv(diffs);
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `audit-diff-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.notify({ tone: 'success', title: 'CSV 다운로드 완료', description: a.download });
  }

  if (original.length === 0) {
    return (
      <EmptyState
        icon={GitCommitHorizontal}
        title="시나리오를 먼저 로드하세요"
        description="편집 탭에서 시나리오를 선택하면 원본과 비교한 diff 가 여기 표시됩니다."
      />
    );
  }

  return (
    <Wrap>
      <SummaryGrid>
        <Stat tone="neutral">
          <span className="label">원본 행</span>
          <span className="value">{original.length}</span>
        </Stat>
        <Stat tone={summary.changedRowCount === 0 ? 'ok' : 'primary'}>
          <span className="label">변경된 행</span>
          <span className="value">{summary.changedRowCount}</span>
        </Stat>
        <Stat tone={summary.totalMinutesMoved === 0 ? 'neutral' : 'warning'}>
          <span className="label">시간 이동 합</span>
          <span className="value">
            {summary.totalMinutesMoved}
            <span className="unit"> 분</span>
          </span>
        </Stat>
        <Stat tone={summary.totalMetersMoved === 0 ? 'neutral' : 'warning'}>
          <span className="label">위치 이동 합</span>
          <span className="value">
            {summary.totalMetersMoved.toFixed(0)}
            <span className="unit"> m</span>
          </span>
        </Stat>
      </SummaryGrid>

      <Stack direction="row" gap={2} align="center" wrap>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          disabled={diffs.length === 0}
        >
          <Download size={14} aria-hidden="true" /> CSV 내보내기
        </Button>
        {!isDirty && (
          <span style={{ fontSize: 12, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={13} aria-hidden="true" /> 원본과 동일
          </span>
        )}
      </Stack>

      {diffs.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="변경 사항이 없습니다"
          description="편집 탭에서 막대를 드래그하거나 키보드 단축키로 이동하면 여기에 diff 가 쌓입니다."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th style={{ width: 200 }}>대상</th>
              <th style={{ width: 80 }}>필드</th>
              <th>before</th>
              <th>after</th>
              <th style={{ width: 90 }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d) => (
              <RowGroup key={d.rowId} diff={d} />
            ))}
          </tbody>
        </Table>
      )}
    </Wrap>
  );
}

function RowGroup({ diff }: { diff: RowDiff }) {
  return (
    <>
      <tr className="row-head">
        <td>
          <strong>{diff.voyage}</strong>{' '}
          <span style={{ color: '#868e9c', fontSize: 12 }}>
            {diff.vessel} · {diff.terminal}-{diff.berth}
          </span>
        </td>
        <td colSpan={3}>
          <Stack direction="row" gap={3}>
            <span className="mono">
              Δstart={' '}
              {renderDelta(diff.deltaMinutes, '분')}
            </span>
            <span className="mono">
              Δy={' '}
              {renderDelta(Number(diff.deltaY.toFixed(1)), 'm')}
            </span>
            <span className="mono" style={{ color: '#868e9c' }}>
              필드 {diff.changedFields.length}개 변경
            </span>
          </Stack>
        </td>
        <td />
      </tr>
      {diff.changedFields.map((c, i) => (
        <tr key={`${diff.rowId}-${c.field}-${i}`} className="field-row">
          <td />
          <td className="mono">{FIELD_LABEL[c.field]}</td>
          <td className="mono">{renderCellValue(c, 'before')}</td>
          <td className="mono">{renderCellValue(c, 'after')}</td>
          <td>
            {c.delta != null && c.delta !== 0
              ? renderDelta(c.delta, c.field === 'start' || c.field === 'end' ? '분' : 'm')
              : '-'}
          </td>
        </tr>
      ))}
    </>
  );
}
