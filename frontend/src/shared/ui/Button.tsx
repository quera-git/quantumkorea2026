import styled from '@emotion/styled';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
}

const STYLED_PROPS = new Set(['variant', 'size']);

export const Button = styled('button', {
  shouldForwardProp: (p) => !STYLED_PROPS.has(p),
})<ButtonProps>(({ theme, variant = 'primary', size = 'md' }) => {
  const palette = {
    primary: {
      bg: theme.color.primary,
      bgHover: theme.color.primaryHover,
      bgActive: theme.color.primaryActive,
      fg: theme.color.textInverse,
      border: 'transparent',
    },
    secondary: {
      bg: theme.color.surface,
      bgHover: theme.color.surfaceAlt,
      bgActive: theme.color.surfaceMuted,
      fg: theme.color.text,
      border: theme.color.borderStrong,
    },
    ghost: {
      bg: 'transparent',
      bgHover: theme.color.surfaceAlt,
      bgActive: theme.color.surfaceMuted,
      fg: theme.color.textMuted,
      border: 'transparent',
    },
    danger: {
      bg: theme.color.danger,
      bgHover: theme.color.dangerHover,
      bgActive: theme.color.dangerHover,
      fg: theme.color.textInverse,
      border: 'transparent',
    },
  }[variant];

  const padding = {
    sm: '4px 10px',
    md: '7px 14px',
    lg: '10px 18px',
  }[size];

  const fontSize = {
    sm: theme.font.size.sm,
    md: theme.font.size.base,
    lg: theme.font.size.md,
  }[size];

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding,
    fontSize,
    fontWeight: theme.font.weight.medium,
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.border}`,
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    userSelect: 'none',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}, transform ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,

    '&:hover:not(:disabled)': {
      background: palette.bgHover,
    },
    '&:active:not(:disabled)': {
      background: palette.bgActive,
      transform: 'translateY(0.5px)',
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: theme.shadow.focus,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  };
});
