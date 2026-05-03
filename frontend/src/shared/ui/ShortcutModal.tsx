import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { Keyboard, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from './Button';

interface Shortcut {
  keys: string[];
  description: string;
  scope: string;
}

const SHORTCUTS: Shortcut[] = [
  // 전역
  { scope: '전역', keys: ['?'], description: '단축키 안내 열기/닫기' },
  { scope: '전역', keys: ['Esc'], description: '모달/선택 해제' },

  // 에디터 (선택된 선박)
  { scope: '에디터', keys: ['←', 'A'], description: '시간 -5분' },
  { scope: '에디터', keys: ['→', 'D'], description: '시간 +5분' },
  { scope: '에디터', keys: ['↑', 'W'], description: '위치 -30m' },
  { scope: '에디터', keys: ['↓', 'S'], description: '위치 +30m' },
  { scope: '에디터', keys: ['⌘Z', 'Ctrl+Z'], description: '실행 취소 (Undo)' },
  { scope: '에디터', keys: ['⇧⌘Z', 'Ctrl+Shift+Z'], description: '다시 실행 (Redo)' },
];

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;
const slideIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const Backdrop = styled.div(({ theme }) => ({
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.36)',
  backdropFilter: 'blur(2px)',
  zIndex: theme.z.modal - 1,
  animation: `${fadeIn} ${theme.motion.duration.fast} ${theme.motion.easing.enter}`,
}));

const Dialog = styled.div(({ theme }) => ({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(560px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 80px)',
  overflow: 'auto',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.lg,
  zIndex: theme.z.modal,
  padding: theme.spacing(5),
  animation: `${slideIn} ${theme.motion.duration.slow} ${theme.motion.easing.enter}`,
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(4),

  '& h2': {
    margin: 0,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
    flex: 1,
  },
}));

const ScopeGroup = styled.div(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '&:last-of-type': { marginBottom: 0 },
  '& .scope': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.letter.wide,
    marginBottom: theme.spacing(2),
  },
  '& dl': {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    rowGap: theme.spacing(2),
    columnGap: theme.spacing(3),
    alignItems: 'center',
  },
  '& dt': {
    fontSize: theme.font.size.sm,
    color: theme.color.text,
  },
  '& dd': {
    margin: 0,
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
  },
}));

const Kbd = styled.kbd(({ theme }) => ({
  padding: '2px 7px',
  background: theme.color.surfaceMuted,
  border: `1px solid ${theme.color.border}`,
  borderBottomWidth: 2,
  borderRadius: theme.radius.sm,
  fontFamily: theme.font.mono,
  fontSize: theme.font.size.xs,
  color: theme.color.text,
  fontWeight: theme.font.weight.medium,
  minWidth: 24,
  textAlign: 'center',
  display: 'inline-block',
}));

const HintBar = styled.div(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(4),
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '6px 12px',
  background: theme.color.text,
  color: theme.color.surface,
  fontSize: theme.font.size.xs,
  fontFamily: theme.font.mono,
  borderRadius: theme.radius.pill,
  boxShadow: theme.shadow.md,
  zIndex: theme.z.sticky,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  opacity: 0.9,
  pointerEvents: 'none',

  '& kbd': {
    background: theme.color.surface,
    color: theme.color.text,
    padding: '1px 5px',
    borderRadius: theme.radius.sm,
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
  },
}));

/**
 * `?` 키로 열리는 단축키 안내 모달.
 * - input/textarea 안에서는 무시.
 * - Esc / 백드롭 클릭 / X 버튼으로 닫기.
 * - 페이지 첫 진입 시 우하단에 5초간 hint bar 한 번 노출.
 */
export function ShortcutModal() {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggle, close]);

  // 첫 진입 hint
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // scope 별 그룹핑
  const grouped = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    const arr = acc[s.scope] ?? [];
    arr.push(s);
    acc[s.scope] = arr;
    return acc;
  }, {});

  return (
    <>
      {!open && showHint && (
        <HintBar role="note">
          <Keyboard size={12} aria-hidden="true" />
          단축키 보기 <kbd>?</kbd>
        </HintBar>
      )}
      {open && (
        <>
          <Backdrop onClick={close} aria-hidden="true" />
          <Dialog
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <Header>
              <Keyboard size={18} aria-hidden="true" />
              <h2 id="shortcut-modal-title">키보드 단축키</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={close}
                aria-label="단축키 안내 닫기"
              >
                <X size={14} aria-hidden="true" />
              </Button>
            </Header>

            {Object.entries(grouped).map(([scope, items]) => (
              <ScopeGroup key={scope}>
                <div className="scope">{scope}</div>
                <dl>
                  {items.map((s, i) => (
                    <KeyRow key={`${scope}-${i}`} shortcut={s} />
                  ))}
                </dl>
              </ScopeGroup>
            ))}
          </Dialog>
        </>
      )}
    </>
  );
}

function KeyRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <>
      <dt>{shortcut.description}</dt>
      <dd>
        {shortcut.keys.map((k, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ fontSize: 11, color: '#868e9c' }}>또는</span>}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </dd>
    </>
  );
}
