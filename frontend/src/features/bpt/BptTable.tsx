import styled from '@emotion/styled';

import type { BPTRecord } from '@/shared/types/schema';

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
  if (records.length === 0) {
    return (
      <Wrap>
        <Empty>적재된 BPT 레코드가 없습니다.</Empty>
      </Wrap>
    );
  }

  return (
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
              <tr key={`${r.vessel_id}-${i}`}>
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
  );
}
