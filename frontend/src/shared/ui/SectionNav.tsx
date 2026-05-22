// 좌측 sticky 사이드 nav. 페이지 내 anchor 점프 + 현재 섹션 하이라이트.
// 좁은 화면에서는 상단 horizontal scroll 으로 전환.

import styled from '@emotion/styled';
import { Keyboard, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface NavGroup {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** 그 그룹 안의 anchor 들 (sub-section). 없으면 그룹 자체로 점프. */
  anchors?: Array<{ id: string; label: string }>;
}

interface Props {
  groups: NavGroup[];
}

const Wrap = styled.aside(({ theme }) => ({
  // 데스크탑: sticky / overflow 책임은 부모 LeftRail (Dashboard.tsx) 가 가짐.
  // 여기선 width + padding 만. 부모 scroll context 안에서 자연 흐름.
  width: 224,
  padding: theme.spacing(3),
  paddingRight: theme.spacing(2),
  fontSize: theme.font.size.sm,

  '@media (max-width: 1024px)': {
    // 모바일은 horizontal strip — 자체 sticky 유지.
    position: 'sticky',
    top: 56,
    width: 'auto',
    overflowX: 'auto',
    background: `${theme.color.surface}f5`,
    backdropFilter: 'saturate(180%) blur(8px)',
    borderBottom: `1px solid ${theme.color.border}`,
    padding: `${theme.spacing(2)} ${theme.spacing(4)}`,
    zIndex: theme.z.sticky - 1,
  },
}));

const GroupRow = styled.div(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '&:last-child': { marginBottom: 0 },

  '@media (max-width: 1024px)': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: 0,
    marginRight: theme.spacing(3),
  },
}));

const GroupLabel = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
  textTransform: 'uppercase',
  fontWeight: theme.font.weight.semibold,
  letterSpacing: theme.font.letter.wide,
  marginBottom: theme.spacing(2),

  '@media (max-width: 1024px)': {
    marginBottom: 0,
    whiteSpace: 'nowrap',
  },
}));

const NavItem = styled('a', {
  shouldForwardProp: (p) => p !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: '6px 10px',
  margin: '2px 0',
  borderRadius: theme.radius.md,
  textDecoration: 'none',
  color: active ? theme.color.primary : theme.color.textMuted,
  fontWeight: active ? theme.font.weight.semibold : theme.font.weight.regular,
  background: active ? theme.color.primarySoft : 'transparent',
  transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}, color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  cursor: 'pointer',

  '&:hover': {
    background: active ? theme.color.primarySoft : theme.color.surfaceAlt,
    color: active ? theme.color.primary : theme.color.text,
  },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },

  '@media (max-width: 1024px)': {
    padding: '4px 10px',
    margin: 0,
    whiteSpace: 'nowrap',
  },
}));

const Dot = styled.span({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'currentColor',
  flexShrink: 0,
  opacity: 0.6,
});

const Hint = styled.div(({ theme }) => ({
  marginTop: theme.spacing(5),
  paddingTop: theme.spacing(3),
  borderTop: `1px solid ${theme.color.borderSubtle}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
  lineHeight: theme.font.lineHeight.normal,

  '& kbd': {
    padding: '1px 6px',
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    background: theme.color.surfaceMuted,
    border: `1px solid ${theme.color.border}`,
    borderBottomWidth: 2,
    borderRadius: theme.radius.sm,
    color: theme.color.text,
  },

  // 모바일 가로 strip 일 땐 공간 부족 — 숨김.
  '@media (max-width: 1024px)': {
    display: 'none',
  },
}));

function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 70;
  window.scrollTo({ top, behavior: 'smooth' });
}

export function SectionNav({ groups }: Props) {
  const [activeId, setActiveId] = useState<string>(groups[0]?.id ?? '');

  // IntersectionObserver 로 현재 보이는 섹션 추적.
  useEffect(() => {
    const ids = groups.flatMap((g) => [g.id, ...(g.anchors?.map((a) => a.id) ?? [])]);
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => e != null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 가장 위쪽에 가까운 visible 섹션을 active 로.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [groups]);

  return (
    <Wrap aria-label="섹션 네비게이션">
      {groups.map((g) => {
        const Icon = g.icon;
        const isGroupActive = activeId === g.id || g.anchors?.some((a) => a.id === activeId);

        return (
          <GroupRow key={g.id}>
            <GroupLabel>
              {Icon && <Icon size={12} aria-hidden="true" />}
              {g.label}
            </GroupLabel>
            <NavItem
              href={`#${g.id}`}
              active={!!isGroupActive && (!g.anchors || g.anchors.length === 0)}
              onClick={(e) => {
                e.preventDefault();
                smoothScrollTo(g.id);
              }}
            >
              <Dot />
              {g.label}
            </NavItem>
            {g.anchors?.map((a) => (
              <NavItem
                key={a.id}
                href={`#${a.id}`}
                active={activeId === a.id}
                onClick={(e) => {
                  e.preventDefault();
                  smoothScrollTo(a.id);
                }}
                style={{ marginLeft: 12 }}
              >
                <Dot />
                {a.label}
              </NavItem>
            ))}
          </GroupRow>
        );
      })}

      <Hint role="note">
        <Keyboard size={12} aria-hidden="true" />
        <span>
          단축키 <kbd>?</kbd>
        </span>
      </Hint>
    </Wrap>
  );
}
