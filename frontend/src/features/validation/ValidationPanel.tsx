import styled from '@emotion/styled';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';

import type { Assignment } from '@/shared/domain/types';

import {
  summarize,
  validateAssignments,
  type ValidationField,
  type ValidationIssue,
} from './validation';

const FIELD_LABEL: Record<ValidationField, string> = {
  terminal: '터미널',
  berth: '선석',
  time: '시간',
  position: '위치',
  clearance: '이격',
};

const Wrap = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const SummaryBar = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: theme.spacing(2),
}));

const SummaryStat = styled.div<{ tone: 'ok' | 'error' | 'warning' | 'neutral' }>(
  ({ theme, tone }) => {
    const palette = {
      ok: { bg: theme.color.successSoft, fg: theme.color.success, border: theme.color.success },
      error: { bg: theme.color.dangerSoft, fg: theme.color.danger, border: theme.color.danger },
      warning: {
        bg: theme.color.warningSoft,
        fg: theme.color.warning,
        border: theme.color.warning,
      },
      neutral: {
        bg: theme.color.surfaceAlt,
        fg: theme.color.textMuted,
        border: theme.color.border,
      },
    }[tone];

    return {
      padding: theme.spacing(3),
      background: palette.bg,
      border: `1px solid ${palette.border}33`,
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
    };
  },
);

const PassWrap = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  background: theme.color.successSoft,
  borderRadius: theme.radius.md,
  color: theme.color.success,
  fontSize: theme.font.size.sm,
  fontWeight: theme.font.weight.medium,
}));

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
  },
  td: {
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.color.borderSubtle}`,
    verticalAlign: 'top',
  },
  'tbody tr:last-of-type td': {
    borderBottom: 'none',
  },
  'tbody tr:hover': {
    background: theme.color.surfaceAlt,
  },
  '.severity': {
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
  },
  '.severity.error': { color: theme.color.danger },
  '.severity.warning': { color: theme.color.warning },
  '.target': {
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
    color: theme.color.textMuted,
  },
}));

interface Props {
  assignments: Assignment[];
}

export function ValidationPanel({ assignments }: Props) {
  const issues = useMemo(() => validateAssignments(assignments), [assignments]);
  const summary = useMemo(() => summarize(issues), [issues]);

  if (assignments.length === 0) {
    return (
      <Wrap>
        <SummaryBar>
          <SummaryStat tone="neutral">
            <span className="label">검사 대상</span>
            <span className="value">0</span>
          </SummaryStat>
        </SummaryBar>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <SummaryBar>
        <SummaryStat tone="neutral">
          <span className="label">검사 대상</span>
          <span className="value">{assignments.length}</span>
        </SummaryStat>
        <SummaryStat tone={summary.errorCount === 0 ? 'ok' : 'error'}>
          <span className="label">에러</span>
          <span className="value">{summary.errorCount}</span>
        </SummaryStat>
        <SummaryStat tone={summary.warningCount === 0 ? 'ok' : 'warning'}>
          <span className="label">경고</span>
          <span className="value">{summary.warningCount}</span>
        </SummaryStat>
        {(['terminal', 'berth', 'time', 'position', 'clearance'] as ValidationField[]).map(
          (f) => (
            <SummaryStat key={f} tone={summary.byField[f] === 0 ? 'neutral' : 'warning'}>
              <span className="label">{FIELD_LABEL[f]}</span>
              <span className="value">{summary.byField[f]}</span>
            </SummaryStat>
          ),
        )}
      </SummaryBar>

      {issues.length === 0 ? (
        <PassWrap role="status">
          <ShieldCheck size={18} aria-hidden="true" />
          모든 검증 통과
        </PassWrap>
      ) : (
        <IssueTable issues={issues} />
      )}
    </Wrap>
  );
}

function IssueTable({ issues }: { issues: ValidationIssue[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th style={{ width: 56 }}>심각도</th>
          <th style={{ width: 84 }}>항목</th>
          <th style={{ width: 240 }}>대상</th>
          <th>메시지</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((it, i) => (
          <tr key={`${it.target}-${it.field}-${i}`}>
            <td>
              <span className={`severity ${it.severity}`}>
                {it.severity === 'error' ? (
                  <AlertTriangle size={14} aria-hidden="true" style={{ verticalAlign: -2 }} />
                ) : null}{' '}
                {it.severity === 'error' ? 'ERROR' : 'WARN'}
              </span>
            </td>
            <td>{FIELD_LABEL[it.field]}</td>
            <td className="target">{it.target}</td>
            <td>{it.message}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
