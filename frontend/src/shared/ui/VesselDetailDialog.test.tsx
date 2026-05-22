import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Assignment } from '@/shared/domain/types';
import { renderWithProviders } from '@/test/renderWithProviders';

import { VesselDetailDialog } from './VesselDetailDialog';

function row(over: Partial<Assignment> = {}): Assignment {
  return {
    rowId: 'r-1',
    voyage: 'PCBS-2026-21',
    vessel: 'PACIFIC BUSAN',
    company: 'HAS',
    sectionRaw: '신선대',
    terminal: 'SND',
    berth: 2,
    route: 'EA',
    start: '2026-05-23T03:00:00.000Z',
    end: '2026-05-23T15:00:00.000Z',
    eta: '2026-05-23T02:00:00.000Z',
    etbInt: null,
    etdInt: null,
    etaInt: null,
    f: 5,
    e: 138,
    length: 133,
    yanghaVan: 190,
    seonjeokVan: 300,
    shiftingVan: 0,
    workHours: 12,
    planStatus: 'crane_assigned',
    ...over,
  };
}

describe('VesselDetailDialog', () => {
  it('open=false 일 때 아무것도 렌더 X', () => {
    renderWithProviders(
      <VesselDetailDialog open={false} assignment={row()} onClose={() => {}} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('open=true & assignment 있으면 모든 핵심 필드 노출', () => {
    renderWithProviders(
      <VesselDetailDialog open assignment={row()} onClose={() => {}} />,
    );
    const dialog = screen.getByRole('dialog');
    // h2 + dd 두 곳 — 적어도 한 번은 노출되면 OK
    expect(within(dialog).getAllByText('PACIFIC BUSAN').length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/SND-2 · PCBS-2026-21/)).toBeInTheDocument();
    expect(within(dialog).getByText('HAS')).toBeInTheDocument();
    expect(within(dialog).getByText('300')).toBeInTheDocument(); // 적하
    expect(within(dialog).getByText('190')).toBeInTheDocument(); // 양하
    expect(within(dialog).getByText('크래인 배정 완료')).toBeInTheDocument();
    // B.P. = (5 + 138) / 2 ≈ 72 (round). 다른 숫자(133 등)도 매칭 가능 → 명시적으로 1개 이상.
    expect(within(dialog).getAllByText(/72/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/F: 5m, E: 138m/)).toBeInTheDocument();
    expect(within(dialog).getByText('133m')).toBeInTheDocument(); // 길이
    expect(within(dialog).getByText('12h')).toBeInTheDocument(); // 작업시간
  });

  it('X 버튼 클릭 시 onClose', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <VesselDetailDialog open assignment={row()} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Esc 키 시 onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <VesselDetailDialog open assignment={row()} onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('backdrop 클릭 시 onClose (dialog 본체 클릭은 무시)', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <VesselDetailDialog open assignment={row()} onClose={onClose} />,
    );
    // backdrop 은 aria-hidden + 첫 portal 노드. dialog 외 백드롭 div 클릭.
    const backdrop = container.ownerDocument.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeTruthy();
    await userEvent.click(backdrop as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();

    // dialog 본체 클릭은 안 닫힘
    onClose.mockClear();
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('issues 있으면 IssueBlock 노출, 각 메시지 li 로 나열', () => {
    renderWithProviders(
      <VesselDetailDialog
        open
        assignment={row()}
        onClose={() => {}}
        issues={['berth 위치 충돌', '선석 범위 초과', '시간 겹침']}
      />,
    );
    const block = screen.getByRole('region', { name: '검증 이슈' });
    expect(within(block).getByText(/⚠ 검증 이슈 3개/)).toBeInTheDocument();
    expect(within(block).getByText('berth 위치 충돌')).toBeInTheDocument();
    expect(within(block).getByText('선석 범위 초과')).toBeInTheDocument();
    expect(within(block).getByText('시간 겹침')).toBeInTheDocument();
  });

  it('issues 없으면 IssueBlock 노출 X', () => {
    renderWithProviders(
      <VesselDetailDialog open assignment={row()} onClose={() => {}} />,
    );
    expect(screen.queryByRole('region', { name: '검증 이슈' })).toBeNull();
  });

  it('open 시 body overflow=hidden (scroll lock), close 시 복원', () => {
    const prev = document.body.style.overflow;
    const { rerender } = renderWithProviders(
      <VesselDetailDialog open assignment={row()} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <VesselDetailDialog open={false} assignment={row()} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe(prev);
  });
});
