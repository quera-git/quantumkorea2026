import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { AlertTriangle, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { Button } from './Button';

interface Props {
  open: boolean;
  title: string;
  description: ReactNode;
  /** 추가 정보(요약 박스). */
  detail?: ReactNode;
  /** 확인 버튼의 톤. 기본 primary, 위험한 동작이면 danger. */
  tone?: 'primary' | 'danger' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

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
  background: 'rgba(15, 23, 42, 0.42)',
  backdropFilter: 'blur(2px)',
  zIndex: theme.z.modal - 1,
  animation: `${fadeIn} ${theme.motion.duration.fast} ${theme.motion.easing.enter}`,
}));

const Dialog = styled.div(({ theme }) => ({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(480px, calc(100vw - 32px))',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.lg,
  zIndex: theme.z.modal,
  padding: theme.spacing(5),
  animation: `${slideIn} ${theme.motion.duration.slow} ${theme.motion.easing.enter}`,
}));

const Header = styled.div<{ tone: 'primary' | 'danger' | 'warning' }>(
  ({ theme, tone }) => {
    const palette = {
      primary: { fg: theme.color.primary, bg: theme.color.primarySoft },
      danger: { fg: theme.color.danger, bg: theme.color.dangerSoft },
      warning: { fg: theme.color.warning, bg: theme.color.warningSoft },
    }[tone];
    return {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(3),

      '& .icon': {
        width: 36,
        height: 36,
        display: 'grid',
        placeItems: 'center',
        borderRadius: theme.radius.md,
        background: palette.bg,
        color: palette.fg,
        flexShrink: 0,
      },
      '& h2': {
        margin: 0,
        fontSize: theme.font.size.lg,
        fontWeight: theme.font.weight.semibold,
        color: theme.color.text,
        letterSpacing: theme.font.letter.tight,
        flex: 1,
      },
      '& .close': {
        background: 'transparent',
        border: 'none',
        color: theme.color.textSubtle,
        cursor: 'pointer',
        padding: 4,
        borderRadius: theme.radius.sm,
      },
      '& .close:hover': { background: theme.color.surfaceAlt, color: theme.color.text },
      '& .close:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
    };
  },
);

const Description = styled.div(({ theme }) => ({
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  lineHeight: theme.font.lineHeight.normal,
  marginBottom: theme.spacing(3),
}));

const Detail = styled.div(({ theme }) => ({
  padding: theme.spacing(3),
  background: theme.color.surfaceAlt,
  borderRadius: theme.radius.md,
  fontSize: theme.font.size.sm,
  fontFamily: theme.font.mono,
  color: theme.color.text,
  marginBottom: theme.spacing(3),
}));

const Actions = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(2),
}));

export function ConfirmDialog({
  open,
  title,
  description,
  detail,
  tone = 'primary',
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: Props) {
  // Esc 닫기 + 포커스 트랩(간이) — 모달 열린 동안 body scroll lock.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <Backdrop onClick={onCancel} aria-hidden="true" />
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <Header tone={tone}>
          <span className="icon" aria-hidden="true">
            <AlertTriangle size={18} strokeWidth={2} />
          </span>
          <h2 id="confirm-dialog-title">{title}</h2>
          <button type="button" className="close" onClick={onCancel} aria-label="닫기">
            <X size={14} aria-hidden="true" />
          </button>
        </Header>
        <Description>{description}</Description>
        {detail && <Detail>{detail}</Detail>}
        <Actions>
          <Button variant="secondary" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Actions>
      </Dialog>
    </>
  );
}
