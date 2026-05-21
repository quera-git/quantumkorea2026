// 선박 막대 클릭 시 뜨는 자세히 보기 모달.
// BPTC 사이트의 info.bptc.co.kr:9084 팝업과 같은 분류 + 우리가 추가로 보존한 모든 필드.
//
// ConfirmDialog 의 backdrop / 가운데 배치 / Esc 닫기 / scroll lock 패턴을 그대로 따른다.

import { keyframes, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { Ship, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { planStatusVisual } from '@/shared/domain/statusColors';
import type { Assignment } from '@/shared/domain/types';

interface Props {
  open: boolean;
  assignment: Assignment | null;
  onClose: () => void;
  /** validation issues — 있으면 본문 하단에 별도 섹션으로 노출. */
  issues?: string[];
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
  width: 'min(520px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.lg,
  zIndex: theme.z.modal,
  animation: `${slideIn} ${theme.motion.duration.slow} ${theme.motion.easing.enter}`,
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: `${theme.spacing(4)} ${theme.spacing(5)}`,
  borderBottom: `1px solid ${theme.color.border}`,

  '& .icon': {
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    borderRadius: theme.radius.md,
    background: theme.color.primarySoft,
    color: theme.color.primary,
    flexShrink: 0,
  },
  '& .titles': { flex: 1, minWidth: 0 },
  '& h2': {
    margin: 0,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& .sub': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    fontFamily: theme.font.mono,
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
}));

const Body = styled.dl(({ theme }) => ({
  margin: 0,
  padding: theme.spacing(5),
  display: 'grid',
  gridTemplateColumns: '100px 1fr',
  rowGap: theme.spacing(2),
  columnGap: theme.spacing(3),
  fontSize: theme.font.size.sm,

  '& dt': {
    color: theme.color.textSubtle,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
    alignSelf: 'center',
  },
  '& dd': {
    margin: 0,
    fontFamily: theme.font.mono,
    color: theme.color.text,
    wordBreak: 'break-all',
  },
}));

const StatusBadge = styled.span<{ bg: string; fg: string; ring: string }>(
  ({ theme, bg, fg, ring }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: '2px 10px',
    borderRadius: theme.radius.pill,
    background: bg,
    color: fg,
    border: `1px solid ${ring}`,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    fontFamily: theme.font.family,
  }),
);

const Footer = styled.div(({ theme }) => ({
  padding: `${theme.spacing(3)} ${theme.spacing(5)} ${theme.spacing(4)}`,
  borderTop: `1px solid ${theme.color.border}`,
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
  fontFamily: theme.font.mono,
  display: 'flex',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
}));

const IssueBlock = styled.div(({ theme }) => ({
  margin: `0 ${theme.spacing(5)} ${theme.spacing(5)}`,
  padding: theme.spacing(3),
  background: theme.color.dangerSoft,
  border: `1px solid ${theme.color.danger}33`,
  borderRadius: theme.radius.md,

  '& .head': {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.danger,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
    marginBottom: theme.spacing(2),
  },
  '& ul': {
    margin: 0,
    paddingLeft: theme.spacing(4),
    fontSize: theme.font.size.sm,
    color: theme.color.text,
    fontFamily: theme.font.family,
  },
  '& li': { marginBottom: 2 },
}));

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  return iso.replace('T', ' ').slice(0, 16);
}

function fmtNum(n: number | null): string {
  return n == null ? '-' : String(n);
}

export function VesselDetailDialog({ open, assignment, onClose, issues }: Props) {
  const theme = useTheme();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !assignment) return null;

  const a = assignment;
  const sv = planStatusVisual(a.planStatus);
  const mid = a.f != null && a.e != null ? Math.round((a.f + a.e) / 2) : null;

  return createPortal(
    <>
      <Backdrop onClick={onClose} aria-hidden="true" />
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="vessel-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <Header>
          <span className="icon" aria-hidden="true">
            <Ship size={16} strokeWidth={2} />
          </span>
          <div className="titles">
            <h2 id="vessel-detail-title">{a.vessel || a.voyage}</h2>
            <div className="sub">
              {a.terminal || '-'}
              {a.berth ? `-${a.berth}` : ''} · {a.voyage}
            </div>
          </div>
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="닫기"
            autoFocus
          >
            <X size={14} aria-hidden="true" />
          </button>
        </Header>

        <Body>
          <dt>모 선 명</dt>
          <dd style={{ fontFamily: theme.font.family }}>{a.vessel || '-'}</dd>

          <dt>모선항차</dt>
          <dd>{a.voyage}</dd>

          <dt>운항선사</dt>
          <dd>{a.company || '-'}</dd>

          <dt>터미널</dt>
          <dd>
            {a.terminal || '-'}
            {a.berth ? ` · B${a.berth}` : ''}
            {a.sectionRaw && <span style={{ color: theme.color.textSubtle }}> ({a.sectionRaw})</span>}
          </dd>

          <dt>항로</dt>
          <dd>{a.route || '-'}</dd>

          <dt>적하 (선적)</dt>
          <dd>{fmtNum(a.seonjeokVan)}</dd>

          <dt>양하</dt>
          <dd>{fmtNum(a.yanghaVan)}</dd>

          <dt>Sft</dt>
          <dd>{fmtNum(a.shiftingVan)}</dd>

          <dt>참 고</dt>
          <dd>
            <StatusBadge bg={sv.swatch + '22'} fg={sv.stroke} ring={sv.swatch + '66'}>
              {sv.label}
            </StatusBadge>
          </dd>

          <dt>B.P.</dt>
          <dd>
            {mid ?? '-'}
            {a.f != null && a.e != null && (
              <span style={{ color: theme.color.textSubtle, marginLeft: 8 }}>
                (F: {a.f}m, E: {a.e}m)
              </span>
            )}
          </dd>

          <dt>길이</dt>
          <dd>{a.length != null ? `${a.length}m` : '-'}</dd>

          <dt>입항(ETA)</dt>
          <dd>{fmtTime(a.eta)}</dd>

          <dt>접안(start)</dt>
          <dd>{fmtTime(a.start)}</dd>

          <dt>완료(end)</dt>
          <dd>{fmtTime(a.end)}</dd>

          <dt>작업시간</dt>
          <dd>{a.workHours != null ? `${a.workHours}h` : '-'}</dd>
        </Body>

        {issues && issues.length > 0 && (
          <IssueBlock role="region" aria-label="검증 이슈">
            <div className="head">⚠ 검증 이슈 {issues.length}개</div>
            <ul>
              {issues.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </IssueBlock>
        )}

        <Footer>
          <span>rowId: {a.rowId}</span>
          <span>Esc 또는 바깥 영역 클릭으로 닫기</span>
        </Footer>
      </Dialog>
    </>,
    document.body,
  );
}
