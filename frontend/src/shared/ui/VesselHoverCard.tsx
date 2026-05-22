// 선박 막대 호버 시 마우스 옆에 떠 있는 가벼운 정보 카드.
// EditorCanvas / SplitTimeline 등에서 공통으로 사용. 포털로 document.body 직속.
//
// 디자인 원칙:
//   - 핵심 5줄만 (voyage/vessel/terminal-berth/시간/상태)
//   - 전체 정보는 클릭 → VesselDetailDialog 가 담당
//   - position: fixed + transform 으로 reflow 최소화
//   - 트랜지션 X — 호버 반응 즉시
//   - 호버 카드 자체에는 pointer-events: none — 카드 위에 마우스가 와도 막대의 leave 이벤트가
//     발생하지 않도록 (모든 클릭/호버는 trigger 막대에서 처리).

import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { planStatusVisual } from '@/shared/domain/statusColors';
import type { Assignment } from '@/shared/domain/types';

interface Props {
  assignment: Assignment;
  /** 화면 기준 trigger 위치 (보통 마우스 좌표 또는 막대 우상단). */
  anchorX: number;
  anchorY: number;
  /** validation issues — 있으면 카드 끝에 ⚠ 카운트 + 첫 메시지 줄을 노출. */
  issues?: string[];
}

const Card = styled.div(({ theme }) => ({
  position: 'fixed',
  zIndex: theme.z.overlay,
  pointerEvents: 'none',
  minWidth: 220,
  maxWidth: 280,
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  boxShadow: theme.shadow.md,
  fontSize: theme.font.size.sm,
  color: theme.color.text,
  lineHeight: theme.font.lineHeight.normal,
}));

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.font.weight.semibold,
  fontSize: theme.font.size.md,
  marginBottom: theme.spacing(1),
  letterSpacing: theme.font.letter.tight,
}));

const Row = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: theme.spacing(2),
  fontFamily: theme.font.mono,
  fontSize: theme.font.size.xs,
  color: theme.color.textMuted,
  '& .k': {
    color: theme.color.textSubtle,
    minWidth: 38,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
    fontSize: 10,
  },
  '& .v': { color: theme.color.text },
}));

const StatusChip = styled.span<{ bg: string; fg: string }>(({ theme, bg, fg }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: '1px 6px',
  borderRadius: theme.radius.pill,
  background: bg,
  color: fg,
  fontSize: 10,
  fontWeight: theme.font.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: theme.font.letter.wide,
}));

const Hint = styled.div(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  fontSize: 10,
  color: theme.color.textSubtle,
  fontFamily: theme.font.mono,
  borderTop: `1px solid ${theme.color.borderSubtle}`,
  paddingTop: theme.spacing(1),
}));

const IssueLine = styled.div(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  paddingTop: theme.spacing(1),
  borderTop: `1px solid ${theme.color.dangerSoft}`,
  fontSize: 11,
  color: theme.color.danger,
  fontWeight: theme.font.weight.semibold,
  '& .msg': {
    display: 'block',
    fontWeight: theme.font.weight.regular,
    fontSize: 10,
    color: theme.color.danger,
    fontFamily: theme.font.mono,
    marginTop: 2,
  },
}));

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  return iso.replace('T', ' ').slice(0, 16);
}

/**
 * 화면 좌상단 기준 anchorX/anchorY 좌측·하단에 카드를 띄운다.
 * 카드가 화면 밖으로 나가면 반대편으로 자동 뒤집기.
 */
export function VesselHoverCard({ assignment, anchorX, anchorY, issues }: Props) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: anchorX + 14, top: anchorY + 14 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let left = anchorX + 14;
    let top = anchorY + 14;
    if (left + rect.width + margin > vw) left = anchorX - rect.width - 14;
    if (top + rect.height + margin > vh) top = anchorY - rect.height - 14;
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    setPos({ left, top });
  }, [anchorX, anchorY, assignment.rowId]);

  const sv = planStatusVisual(assignment.planStatus);

  return createPortal(
    <Card ref={ref} role="tooltip" style={{ left: pos.left, top: pos.top }}>
      <Title>
        {assignment.voyage}
        {assignment.vessel && (
          <span style={{ color: theme.color.textMuted, fontWeight: 400, marginLeft: 6 }}>
            · {assignment.vessel}
          </span>
        )}
      </Title>
      <Row>
        <span className="k">선석</span>
        <span className="v">
          {assignment.terminal || '-'}
          {assignment.berth ? `-${assignment.berth}` : ''}
        </span>
      </Row>
      <Row>
        <span className="k">선사</span>
        <span className="v">{assignment.company || '-'}</span>
      </Row>
      <Row>
        <span className="k">시간</span>
        <span className="v">
          {fmtTime(assignment.start)} ~ {fmtTime(assignment.end)}
        </span>
      </Row>
      <Row>
        <span className="k">상태</span>
        <span className="v">
          <StatusChip bg={sv.swatch + '33'} fg={sv.swatch}>
            {sv.label}
          </StatusChip>
        </span>
      </Row>
      {issues && issues.length > 0 && (
        <IssueLine>
          ⚠ {issues.length}개 이슈
          <span className="msg">{issues[0]}</span>
        </IssueLine>
      )}
      <Hint>클릭하여 자세히 보기</Hint>
    </Card>,
    document.body,
  );
}
