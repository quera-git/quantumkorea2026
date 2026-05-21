// BPT 1D 레코드 read-only 테이블.
// Phase 9 — 각 행에 hover/click 라우팅 추가. 행 호버 시 VesselHoverCard,
// 클릭 시 VesselDetailDialog. BPTRecord 는 reference time 정보가 없어 시간이 hour offset
// 으로만 표시된다 (dialog 에서 ISO 시간 - 로 표기).

import styled from '@emotion/styled';
import { useMemo, useState } from 'react';

import { bptRecordToAssignment } from '@/shared/domain/vesselAdapters';
import type { BPTRecord } from '@/shared/types/schema';
import { VesselDetailDialog } from '@/shared/ui/VesselDetailDialog';
import { VesselHoverCard } from '@/shared/ui/VesselHoverCard';

const Wrap = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',
  background: theme.color.surface,
}));

const ScrollArea = styled.div({
  overflowX: 'auto',
  maxHeight: 280,
  overflowY: 'auto',
});

const Table = styled.table(({ theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: theme.font.size.sm,

  'th, td': {
    padding: '8px 12px',
    textAlign: 'left',
    borderBottom: `1px solid ${theme.color.border}`,
    whiteSpace: 'nowrap',
  },
  thead: {
    background: theme.color.surfaceAlt,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  th: {
    fontWeight: theme.font.weight.semibold,
    color: theme.color.textMuted,
  },
  'tbody tr': {
    cursor: 'pointer',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  },
  'tbody tr:hover': {
    background: theme.color.surfaceAlt,
  },
  'tbody tr:last-of-type td': {
    borderBottom: 'none',
  },
  'td.num': {
    fontFamily: theme.font.mono,
    textAlign: 'right',
  },
}));

const Empty = styled.div(({ theme }) => ({
  padding: theme.spacing(6),
  textAlign: 'center',
  color: theme.color.textMuted,
  fontSize: theme.font.size.sm,
}));

interface Props {
  records: BPTRecord[];
}

export function BptTable({ records }: Props) {
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);

  // 행 → Assignment-like (메모) — reference time 모름 → ISO 시간은 null.
  const assignments = useMemo(
    () => records.map((r, i) => bptRecordToAssignment(r, i, null)),
    [records],
  );

  const hoverAssignment = hover ? (assignments[hover.idx] ?? null) : null;
  const detailAssignment = detailIdx != null ? (assignments[detailIdx] ?? null) : null;

  if (records.length === 0) {
    return (
      <Wrap>
        <Empty>적재된 BPT 레코드가 없습니다.</Empty>
      </Wrap>
    );
  }

  return (
    <>
      <Wrap>
        <ScrollArea>
          <Table>
            <thead>
              <tr>
                <th>vessel_id</th>
                <th>length</th>
                <th>eta_int</th>
                <th>etb_int</th>
                <th>etd_int</th>
                <th>berth_pos</th>
                <th>yangha</th>
                <th>seonjeok</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr
                  key={`${r.vessel_id}-${i}`}
                  onPointerEnter={(e) => setHover({ idx: i, x: e.clientX, y: e.clientY })}
                  onPointerMove={(e) =>
                    setHover((prev) =>
                      prev?.idx === i ? { ...prev, x: e.clientX, y: e.clientY } : prev,
                    )
                  }
                  onPointerLeave={() =>
                    setHover((prev) => (prev?.idx === i ? null : prev))
                  }
                  onClick={() => setDetailIdx(i)}
                  aria-label={`${r.vessel_id} 상세 보기`}
                >
                  <td>{r.vessel_id}</td>
                  <td className="num">{r.length}</td>
                  <td className="num">{r.eta_int}</td>
                  <td className="num">{r.etb_int}</td>
                  <td className="num">{r.etd_int}</td>
                  <td className="num">{r.berth_position}</td>
                  <td className="num">{r.yangha_van}</td>
                  <td className="num">{r.seonjeok_van}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ScrollArea>
      </Wrap>

      {hover && hoverAssignment && (
        <VesselHoverCard assignment={hoverAssignment} anchorX={hover.x} anchorY={hover.y} />
      )}
      <VesselDetailDialog
        open={detailIdx !== null}
        assignment={detailAssignment}
        onClose={() => setDetailIdx(null)}
      />
    </>
  );
}
