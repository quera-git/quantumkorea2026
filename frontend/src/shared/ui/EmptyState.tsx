import styled from '@emotion/styled';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const Wrap = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: `${theme.spacing(8)} ${theme.spacing(4)}`,
  border: `1px dashed ${theme.color.borderSubtle}`,
  borderRadius: theme.radius.lg,
  background: theme.color.surfaceAlt,
  color: theme.color.textMuted,
}));

const IconWrap = styled.div(({ theme }) => ({
  width: 40,
  height: 40,
  display: 'grid',
  placeItems: 'center',
  borderRadius: theme.radius.pill,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  color: theme.color.textSubtle,
  marginBottom: theme.spacing(3),
}));

const Title = styled.h3(({ theme }) => ({
  margin: 0,
  fontSize: theme.font.size.md,
  fontWeight: theme.font.weight.semibold,
  color: theme.color.text,
  letterSpacing: theme.font.letter.tight,
}));

const Description = styled.p(({ theme }) => ({
  margin: 0,
  marginTop: theme.spacing(1),
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  lineHeight: theme.font.lineHeight.relaxed,
  maxWidth: 360,
}));

const Action = styled.div(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <Wrap role="status">
      {Icon && (
        <IconWrap aria-hidden="true">
          <Icon size={20} strokeWidth={1.6} />
        </IconWrap>
      )}
      <Title>{title}</Title>
      {description && <Description>{description}</Description>}
      {action && <Action>{action}</Action>}
    </Wrap>
  );
}
