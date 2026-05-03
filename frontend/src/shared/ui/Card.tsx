import styled from '@emotion/styled';

interface CardProps {
  /** 위험/오류 강조 카드 (테두리 색만 변경). */
  tone?: 'default' | 'danger' | 'success' | 'warning';
  /** hover 시 살짝 lift. 기본 true. */
  interactive?: boolean;
}

const TONE_BORDER = {
  default: 'border',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
} as const;

export const Card = styled('section', {
  shouldForwardProp: (p) => !['tone', 'interactive'].includes(p),
})<CardProps>(({ theme, tone = 'default', interactive = true }) => {
  const borderColor = theme.color[TONE_BORDER[tone] as keyof typeof theme.color];

  return {
    background: theme.color.surface,
    border: `1px solid ${borderColor}`,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(6),
    boxShadow: theme.shadow.sm,
    transition: `box-shadow ${theme.motion.duration.base} ${theme.motion.easing.standard}, border-color ${theme.motion.duration.base} ${theme.motion.easing.standard}`,

    ...(interactive && {
      '&:hover': {
        boxShadow: theme.shadow.md,
      },
    }),
  };
});

export const CardTitle = styled.h2(({ theme }) => ({
  margin: 0,
  marginBottom: theme.spacing(3),
  fontSize: theme.font.size.lg,
  fontWeight: theme.font.weight.semibold,
  color: theme.color.text,
  letterSpacing: theme.font.letter.tight,
}));

export const CardSubtitle = styled.p(({ theme }) => ({
  margin: 0,
  marginBottom: theme.spacing(3),
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  lineHeight: theme.font.lineHeight.normal,
}));
