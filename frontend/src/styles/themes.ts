// light / dark 두 벌 + 공유 motion/font/radius/spacing/z 토큰.
// 모든 색은 두 벌 모두 정의. 컴포넌트는 useTheme() 가 반환하는 현재 theme 만 보면 됨.

const motion = {
  duration: { fast: '120ms', base: '180ms', slow: '320ms' },
  easing: {
    standard: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

const radius = {
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  pill: '999px',
} as const;

const font = {
  family: `'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace`,
  size: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    xxl: '22px',
    title: '26px',
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.15, normal: 1.5, relaxed: 1.7 },
  letter: { tight: '-0.02em', normal: '0', wide: '0.04em' },
} as const;

const z = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
} as const;

const spacing = (n: number): string => `${n * 4}px`;

/** light 팔레트 — Linear/Vercel 톤. */
const lightColor = {
  bg: '#fafbfc',
  surface: '#ffffff',
  surfaceAlt: '#f4f5f8',
  surfaceMuted: '#eceef3',
  border: '#e1e4ec',
  borderStrong: '#c8cdd9',
  borderSubtle: '#eef0f4',
  text: '#0a0d14',
  textMuted: '#525866',
  textSubtle: '#868e9c',
  textInverse: '#ffffff',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryActive: '#1e40af',
  primarySoft: '#dbeafe',
  primarySoftHover: '#bfdbfe',
  danger: '#dc2626',
  dangerHover: '#b91c1c',
  dangerSoft: '#fee2e2',
  success: '#16a34a',
  successHover: '#15803d',
  successSoft: '#dcfce7',
  warning: '#d97706',
  warningHover: '#b45309',
  warningSoft: '#fef3c7',
  info: '#0891b2',
  infoHover: '#0e7490',
  infoSoft: '#cffafe',
  focusRing: 'rgba(37, 99, 235, 0.45)',
} as const;

/** dark 팔레트 — Linear dark, GitHub dark 톤 혼합. WCAG AA contrast. */
const darkColor = {
  bg: '#0a0d14',
  surface: '#11151e',
  surfaceAlt: '#161b27',
  surfaceMuted: '#1d2330',
  border: '#252b3a',
  borderStrong: '#373f54',
  borderSubtle: '#1a1f2b',
  text: '#e5e9f5',
  textMuted: '#9aa3b8',
  textSubtle: '#6b7387',
  textInverse: '#0a0d14',
  primary: '#5b8dff',
  primaryHover: '#7aa3ff',
  primaryActive: '#4878e5',
  primarySoft: 'rgba(91, 141, 255, 0.16)',
  primarySoftHover: 'rgba(91, 141, 255, 0.24)',
  danger: '#f87171',
  dangerHover: '#fca5a5',
  dangerSoft: 'rgba(248, 113, 113, 0.16)',
  success: '#4ade80',
  successHover: '#86efac',
  successSoft: 'rgba(74, 222, 128, 0.16)',
  warning: '#fbbf24',
  warningHover: '#fcd34d',
  warningSoft: 'rgba(251, 191, 36, 0.16)',
  info: '#22d3ee',
  infoHover: '#67e8f9',
  infoSoft: 'rgba(34, 211, 238, 0.16)',
  focusRing: 'rgba(91, 141, 255, 0.55)',
} as const;

const shadowLight = {
  none: 'none',
  sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
  md: '0 2px 6px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
  lg: '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
  focus: '0 0 0 3px rgba(37, 99, 235, 0.45)',
} as const;

const shadowDark = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 2px 6px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.35)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 4px rgba(0, 0, 0, 0.4)',
  focus: '0 0 0 3px rgba(91, 141, 255, 0.55)',
} as const;

export type ColorMode = 'light' | 'dark';

export const lightTheme = {
  mode: 'light' as ColorMode,
  color: lightColor,
  spacing,
  radius,
  shadow: shadowLight,
  font,
  motion,
  z,
} as const;

export const darkTheme = {
  mode: 'dark' as ColorMode,
  color: darkColor,
  spacing,
  radius,
  shadow: shadowDark,
  font,
  motion,
  z,
} as const;

export type AppTheme = typeof lightTheme;

export function themeForMode(mode: ColorMode): AppTheme {
  return mode === 'dark' ? (darkTheme as unknown as AppTheme) : lightTheme;
}
