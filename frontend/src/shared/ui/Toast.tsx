import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'info' | 'success' | 'warning' | 'danger';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastContextValue {
  notify: (input: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Region = styled.div(({ theme }) => ({
  position: 'fixed',
  top: theme.spacing(4),
  right: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  zIndex: theme.z.toast,
  pointerEvents: 'none',
  width: 'min(360px, calc(100vw - 32px))',
}));

const ToastCard = styled.div<{ tone: ToastTone }>(({ theme, tone }) => {
  const palette = {
    info: { ring: theme.color.info, soft: theme.color.infoSoft },
    success: { ring: theme.color.success, soft: theme.color.successSoft },
    warning: { ring: theme.color.warning, soft: theme.color.warningSoft },
    danger: { ring: theme.color.danger, soft: theme.color.dangerSoft },
  }[tone];

  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderLeft: `3px solid ${palette.ring}`,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadow.lg,
    fontSize: theme.font.size.sm,
    color: theme.color.text,
    pointerEvents: 'auto',
    animation: `${slideIn} ${theme.motion.duration.slow} ${theme.motion.easing.enter}`,

    '& .icon': {
      flexShrink: 0,
      color: palette.ring,
      marginTop: 1,
    },
    '& .body': { flex: 1, minWidth: 0 },
    '& .title': { fontWeight: theme.font.weight.semibold, color: theme.color.text },
    '& .desc': {
      marginTop: theme.spacing(0.5),
      color: theme.color.textMuted,
      fontSize: theme.font.size.sm,
      lineHeight: theme.font.lineHeight.normal,
      wordBreak: 'break-word',
    },
    '& .close': {
      background: 'transparent',
      border: 'none',
      padding: 4,
      borderRadius: theme.radius.sm,
      color: theme.color.textSubtle,
      cursor: 'pointer',
      flexShrink: 0,
      marginLeft: 'auto',
    },
    '& .close:hover': { background: theme.color.surfaceAlt, color: theme.color.text },
    '& .close:focus-visible': {
      outline: 'none',
      boxShadow: theme.shadow.focus,
    },
  };
});

const ICONS: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: AlertCircle,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback<ToastContextValue['notify']>((input) => {
    seq.current += 1;
    const id = seq.current;
    const t: Toast = {
      id,
      tone: input.tone,
      title: input.title,
      description: input.description,
      durationMs: input.durationMs ?? 4000,
    };
    setToasts((prev) => [...prev, t]);
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <Region role="region" aria-live="polite" aria-label="알림">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </Region>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const t = setTimeout(onDismiss, toast.durationMs);
    return () => clearTimeout(t);
  }, [toast.durationMs, onDismiss]);

  return (
    <ToastCard tone={toast.tone} role="alert">
      <Icon size={18} className="icon" aria-hidden="true" />
      <div className="body">
        <div className="title">{toast.title}</div>
        {toast.description && <div className="desc">{toast.description}</div>}
      </div>
      <button type="button" className="close" onClick={onDismiss} aria-label="알림 닫기">
        <X size={14} aria-hidden="true" />
      </button>
    </ToastCard>
  );
}

/** Toast 알림 발행 hook. ToastProvider 외부에서 호출 시 throw. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error('useToast 는 ToastProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
