import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { useQuery } from '@tanstack/react-query';
import { Anchor } from 'lucide-react';

import { extractErrorMessage } from '@/shared/api/client';
import { getHealth } from '@/shared/api/health.api';
import { queryKeys } from '@/shared/api/queryKeys';

const APP_VERSION = '0.2.0-mvp1';

const Bar = styled.header(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: theme.z.sticky,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(4),
  height: 56,
  padding: `0 ${theme.spacing(6)}`,
  background: `${theme.color.surface}f5`,
  backdropFilter: 'saturate(180%) blur(12px)',
  borderBottom: `1px solid ${theme.color.border}`,
}));

const Brand = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  fontSize: theme.font.size.md,
  fontWeight: theme.font.weight.semibold,
  letterSpacing: theme.font.letter.tight,
  color: theme.color.text,

  '& .logo': {
    width: 28,
    height: 28,
    borderRadius: theme.radius.md,
    display: 'grid',
    placeItems: 'center',
    background: `linear-gradient(135deg, ${theme.color.primary} 0%, ${theme.color.info} 100%)`,
    color: '#fff',
  },

  '& .version': {
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    color: theme.color.textSubtle,
    fontWeight: theme.font.weight.regular,
    padding: '2px 6px',
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    marginLeft: theme.spacing(2),
  },
}));

const Spacer = styled.div({ flex: 1 });

const HealthChip = styled.div<{ tone: 'ok' | 'fail' | 'loading' }>(({ theme, tone }) => {
  const palette = {
    ok: { dot: theme.color.success, fg: theme.color.text, bg: theme.color.successSoft },
    fail: { dot: theme.color.danger, fg: theme.color.danger, bg: theme.color.dangerSoft },
    loading: { dot: theme.color.textSubtle, fg: theme.color.textMuted, bg: theme.color.surfaceAlt },
  }[tone];

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: '4px 10px',
    background: palette.bg,
    color: palette.fg,
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    borderRadius: theme.radius.pill,
    border: `1px solid ${theme.color.border}`,

    '& .dot': {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: palette.dot,
      flexShrink: 0,
      animation:
        tone === 'ok'
          ? `${pulseDot} 2s ${theme.motion.easing.standard} infinite`
          : 'none',
    },
  };
});

const pulseDot = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6); }
  50%      { box-shadow: 0 0 0 5px rgba(22, 163, 74, 0); }
`;

export function AppBar() {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: false,
  });

  const tone: 'ok' | 'fail' | 'loading' = health.error
    ? 'fail'
    : health.data
      ? 'ok'
      : 'loading';

  const label =
    tone === 'ok'
      ? '백엔드 연결됨'
      : tone === 'fail'
        ? `백엔드 끊김 — ${extractErrorMessage(health.error)}`
        : '확인 중…';

  return (
    <Bar role="banner">
      <Brand>
        <span className="logo" aria-hidden="true">
          <Anchor size={16} strokeWidth={2.2} />
        </span>
        <span>항만 양자 최적화</span>
        <span className="version">v{APP_VERSION}</span>
      </Brand>

      <Spacer />

      <HealthChip tone={tone} aria-live="polite" title={label}>
        <span className="dot" aria-hidden="true" />
        <span>{tone === 'ok' ? 'backend ok' : tone === 'fail' ? 'backend down' : 'checking'}</span>
      </HealthChip>
    </Bar>
  );
}
