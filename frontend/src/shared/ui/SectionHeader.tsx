import styled from '@emotion/styled';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const Wrap = styled.header(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(3),
  marginBottom: theme.spacing(4),
}));

const IconBox = styled.div(({ theme }) => ({
  width: 32,
  height: 32,
  flexShrink: 0,
  display: 'grid',
  placeItems: 'center',
  borderRadius: theme.radius.md,
  background: theme.color.primarySoft,
  color: theme.color.primary,
}));

const TextCol = styled.div({
  flex: 1,
  minWidth: 0,
});

const TitleRow = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
}));

const Title = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: theme.font.size.xl,
  fontWeight: theme.font.weight.semibold,
  color: theme.color.text,
  letterSpacing: theme.font.letter.tight,
}));

const Number = styled.span(({ theme }) => ({
  fontSize: theme.font.size.xs,
  fontWeight: theme.font.weight.semibold,
  color: theme.color.textSubtle,
  fontFamily: theme.font.mono,
  letterSpacing: theme.font.letter.wide,
  textTransform: 'uppercase',
}));

const Description = styled.p(({ theme }) => ({
  margin: 0,
  marginTop: theme.spacing(1),
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  lineHeight: theme.font.lineHeight.normal,
}));

const Aside = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginLeft: theme.spacing(2),
  flexShrink: 0,
}));

interface Props {
  icon?: LucideIcon;
  number?: string;
  title: ReactNode;
  description?: ReactNode;
  /** 우측 aside 영역 (예: 갱신 중 표시, 보조 액션). */
  aside?: ReactNode;
}

export function SectionHeader({ icon: Icon, number, title, description, aside }: Props) {
  return (
    <Wrap>
      {Icon && (
        <IconBox aria-hidden="true">
          <Icon size={18} strokeWidth={1.8} />
        </IconBox>
      )}
      <TextCol>
        <TitleRow>
          {number && <Number>{number}</Number>}
          <Title>{title}</Title>
        </TitleRow>
        {description && <Description>{description}</Description>}
      </TextCol>
      {aside && <Aside>{aside}</Aside>}
    </Wrap>
  );
}
