// 디자인 토큰. Linear/Vercel 톤의 dense data tool 미감을 노린다.
// 토큰만 정의 — 컴포넌트는 ThemeProvider 로 받아서 쓴다.

export const theme = {
  color: {
    // 베이스 — 살짝 푸른빛 도는 회색 (Linear 닮음)
    bg: '#fafbfc',
    surface: '#ffffff',
    surfaceAlt: '#f4f5f8',
    surfaceMuted: '#eceef3',

    // 테두리 — 살짝 cool tone
    border: '#e1e4ec',
    borderStrong: '#c8cdd9',
    borderSubtle: '#eef0f4',

    // 텍스트 — high contrast 위계
    text: '#0a0d14',
    textMuted: '#525866',
    textSubtle: '#868e9c',
    textInverse: '#ffffff',

    // Brand
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryActive: '#1e40af',
    primarySoft: '#dbeafe',
    primarySoftHover: '#bfdbfe',

    // Semantic
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

    // Focus ring (a11y, 일관)
    focusRing: 'rgba(37, 99, 235, 0.45)',
  },
  spacing: (n: number): string => `${n * 4}px`,
  radius: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    pill: '999px',
  },
  shadow: {
    none: 'none',
    sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
    md: '0 2px 6px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
    lg: '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    focus: '0 0 0 3px rgba(37, 99, 235, 0.45)',
  },
  font: {
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
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
    letter: { tight: '-0.01em', normal: '0', wide: '0.04em' },
  },
  motion: {
    duration: {
      fast: '120ms',
      base: '180ms',
      slow: '320ms',
    },
    easing: {
      // Linear 가 즐겨 쓰는 부드러운 ease-out
      standard: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      enter: 'cubic-bezier(0, 0, 0.2, 1)',
      exit: 'cubic-bezier(0.4, 0, 1, 1)',
      bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
  z: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    toast: 500,
  },
} as const;

export type AppTheme = typeof theme;
