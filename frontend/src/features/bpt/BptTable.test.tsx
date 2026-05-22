import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { BPTRecord } from '@/shared/types/schema';
import { renderWithProviders } from '@/test/renderWithProviders';

import { BptTable } from './BptTable';

function rec(over: Partial<BPTRecord> = {}): BPTRecord {
  return {
    vessel_id: 'D-1',
    length: 200,
    eta_int: 0,
    etb_int: 1,
    etd_int: 9,
    berth_position: 100,
    yangha_van: 30,
    seonjeok_van: 300,
    ...over,
  };
}

describe('BptTable', () => {
  it('records 0건 → "적재된 BPT 레코드가 없습니다"', () => {
    renderWithProviders(<BptTable records={[]} />);
    expect(screen.getByText(/적재된 BPT 레코드가 없습니다/)).toBeInTheDocument();
  });

  it('records 표 형태로 나열', () => {
    renderWithProviders(<BptTable records={[rec(), rec({ vessel_id: 'D-2' })]} />);
    expect(screen.getByText('D-1')).toBeInTheDocument();
    expect(screen.getByText('D-2')).toBeInTheDocument();
  });

  it('행 호버 → VesselHoverCard (role=tooltip) 등장', () => {
    renderWithProviders(<BptTable records={[rec()]} />);
    const row = screen.getByLabelText('D-1 상세 보기');
    fireEvent.pointerEnter(row, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('행 클릭 → VesselDetailDialog 열림', async () => {
    renderWithProviders(<BptTable records={[rec()]} />);
    const row = screen.getByLabelText('D-1 상세 보기');
    await userEvent.click(row);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Dialog 닫기 (X 버튼) → dialog 사라짐', async () => {
    renderWithProviders(<BptTable records={[rec()]} />);
    await userEvent.click(screen.getByLabelText('D-1 상세 보기'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
