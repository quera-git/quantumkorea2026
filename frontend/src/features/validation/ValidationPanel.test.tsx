import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';
import { renderWithProviders } from '@/test/renderWithProviders';

import { ValidationPanel } from './ValidationPanel';

/** 검증 입력용 최소 Assignment fixture (정적 시나리오 제거에 따른 inline 대체). */
function rowFor(over: Partial<Assignment> = {}): Assignment {
  return {
    rowId: over.rowId ?? 'r-0',
    voyage: 'V-1',
    vessel: 'VESSEL',
    company: 'CO',
    sectionRaw: '신선대',
    terminal: 'SND',
    berth: 1,
    route: 'NCK',
    start: '2026-05-22T01:00:00',
    end: '2026-05-22T07:00:00',
    eta: '2026-05-22T01:00:00',
    etbInt: null,
    etdInt: null,
    etaInt: null,
    f: 18,
    e: 168,
    length: 150,
    yanghaVan: 0,
    seonjeokVan: 0,
    shiftingVan: 0,
    workHours: 6,
    planStatus: null,
    ...over,
  };
}

describe('<ValidationPanel />', () => {
  it('빈 입력 → 검사 대상 0', () => {
    renderWithProviders(<ValidationPanel assignments={[]} />);
    expect(screen.getByText('검사 대상')).toBeInTheDocument();
    const totals = screen.getAllByText('0');
    expect(totals.length).toBeGreaterThan(0);
  });

  it('실 시나리오 입력 → 통계 + (이슈 있을 시) 테이블', () => {
    const rows = [
      rowFor({ rowId: 'r-0', voyage: 'A', berth: 1, f: 18, e: 168 }),
      rowFor({ rowId: 'r-1', voyage: 'B', berth: 2, f: 320, e: 470 }),
      rowFor({ rowId: 'r-2', voyage: 'C', berth: 3, f: 620, e: 770 }),
    ];
    renderWithProviders(<ValidationPanel assignments={rows} />);
    expect(screen.getByText('검사 대상')).toBeInTheDocument();
    const labels = screen.getAllByText('검사 대상');
    expect(labels.length).toBeGreaterThanOrEqual(1);
    // 통과/실패 둘 중 하나만 떠야 함
    const passOrIssues =
      screen.queryByText('모든 검증 통과') ?? screen.queryByText(/심각도/) ?? null;
    expect(passOrIssues).not.toBeNull();
  });
});
