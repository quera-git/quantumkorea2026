import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { useQuery } from '@tanstack/react-query';
import { Anchor, Menu, Moon, Sun } from 'lucide-react';

import { useColorMode } from '@/app/colorMode';
import { extractErrorMessage } from '@/shared/api/client';
import { getHealth } from '@/shared/api/health.api';
import { queryKeys } from '@/shared/api/queryKeys';

const APP_VERSION = '0.3.0-mvp1+phase7';

const Bar = styled.header(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: theme.z.sticky,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(4),
  height: 56,
  padding: `0 ${theme.spacing(6)}`,
  background:
    theme.mode === 'dark'
      ? 'rgba(17, 21, 30, 0.78)'
      : 'rgba(255, 255, 255, 0.78)',
  backdropFilter: 'saturate(180%) blur(12px)',
  borderBottom: `1px solid ${theme.color.border}`,

  '@media (max-width: 768px)': {
    padding: `0 ${theme.spacing(3)}`,
    gap: theme.spacing(2),
  },
}));

const Brand = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  fontSize: theme.font.size.md,
  fontWeight: theme.font.weight.semibold,
  letterSpacing: theme.font.letter.tight,
  color: theme.color.text,
  fontVariantNumeric: 'tabular-nums',

  '& .logo': {
    width: 28,
    height: 28,
    borderRadius: theme.radius.md,
    display: 'grid',
    placeItems: 'center',
    background: `linear-gradient(135deg, ${theme.color.primary} 0%, ${theme.color.info} 100%)`,
    color: '#fff',
    flexShrink: 0,
  },

  '& .name': {
    '@media (max-width: 540px)': { display: 'none' },
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
    '@media (max-width: 768px)': { display: 'none' },
  },
}));

const Spacer = styled.div({ flex: 1 });

const HamburgerBtn = styled.button(({ theme }) => ({
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  background: 'transparent',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  color: theme.color.textMuted,
  cursor: 'pointer',

  '&:hover': { background: theme.color.surfaceAlt, color: theme.color.text },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },

  '@media (max-width: 1024px)': {
    display: 'inline-flex',
  },
}));

const ColorModeBtn = styled.button(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  background: 'transparent',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  color: theme.color.textMuted,
  cursor: 'pointer',
  transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}, color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,

  '&:hover': { background: theme.color.surfaceAlt, color: theme.color.text },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

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
        tone === 'ok' ? `${pulseDot} 2s ${theme.motion.easing.standard} infinite` : 'none',
    },

    '@media (max-width: 540px)': {
      '& .label': { display: 'none' },
    },
  };
});

const pulseDot = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5); }
  50%      { box-shadow: 0 0 0 5px rgba(22, 163, 74, 0); }
`;

interface Props {
  /** 햄버거 버튼 클릭 시 호출 — 좁은 화면에서 SectionNav 드로워 토글용. */
  onMenuClick?: () => void;
}

export function AppBar({ onMenuClick }: Props) {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: false,
  });
  const { mode, toggle } = useColorMode();

  const tone: 'ok' | 'fail' | 'loading' = health.error ? 'fail' : health.data ? 'ok' : 'loading';

  const label =
    tone === 'ok'
      ? '백엔드 연결됨'
      : tone === 'fail'
        ? `백엔드 끊김 — ${extractErrorMessage(health.error)}`
        : '확인 중…';

  return (
    <Bar role="banner">
      {onMenuClick && (
        <HamburgerBtn type="button" aria-label="섹션 메뉴 열기" onClick={onMenuClick}>
          <Menu size={16} aria-hidden="true" />
        </HamburgerBtn>
      )}

      <Brand>
        <span className="logo" aria-hidden="true">
          <Anchor size={16} strokeWidth={2.2} />
        </span>
        <span className="name">항만 양자 최적화</span>
        <span className="version">v{APP_VERSION}</span>
      </Brand>

      <Spacer />

      <HealthChip tone={tone} aria-live="polite" title={label}>
        <span className="dot" aria-hidden="true" />
        <span className="label">
          {tone === 'ok' ? 'backend ok' : tone === 'fail' ? 'backend down' : 'checking'}
        </span>
      </HealthChip>

      <ColorModeBtn
        type="button"
        aria-label={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        onClick={toggle}
        title={mode === 'dark' ? '라이트 모드' : '다크 모드'}
      >
        {mode === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
      </ColorModeBtn>
    </Bar>
  );
}
