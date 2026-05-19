import styled from '@emotion/styled';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const Wrap = styled.section(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(5),
  scrollMarginTop: theme.spacing(20),
}));

const Header = styled.header(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(3),
  paddingBottom: theme.spacing(4),
  borderBottom: `1px solid ${theme.color.border}`,
}));

const IconBadge = styled.div(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: theme.radius.md,
  background: theme.color.primarySoft,
  color: theme.color.primary,
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
}));

const Text = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,

  '& .label': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.letter.wide,
  },
  '& h2': {
    margin: 0,
    marginTop: 2,
    fontSize: theme.font.size.xxl,
    fontWeight: theme.font.weight.bold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
  },
  '& p': {
    margin: 0,
    marginTop: theme.spacing(1.5),
    fontSize: theme.font.size.md,
    color: theme.color.textMuted,
    lineHeight: theme.font.lineHeight.relaxed,
    maxWidth: 720,
  },
}));

interface Props {
  id: string;
  icon?: LucideIcon;
  /** 섹션 위 라벨 (예: "그룹 A"). */
  label?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

export function SectionGroup({ id, icon: Icon, label, title, description, children }: Props) {
  return (
    <Wrap id={id} aria-labelledby={`${id}-title`}>
      <Header>
        {Icon && (
          <IconBadge aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </IconBadge>
        )}
        <Text>
          {label && <div className="label">{label}</div>}
          <h2 id={`${id}-title`}>{title}</h2>
          {description && <p>{description}</p>}
        </Text>
      </Header>
      {children}
    </Wrap>
  );
}
