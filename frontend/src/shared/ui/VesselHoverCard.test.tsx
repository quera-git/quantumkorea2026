import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';
import { renderWithProviders } from '@/test/renderWithProviders';

import { VesselHoverCard } from './VesselHoverCard';

function row(over: Partial<Assignment> = {}): Assignment {
  return {
    rowId: 'r-1',
    voyage: 'JKAH-6',
    vessel: 'KAI HANG 5',
    company: 'DYS',
    sectionRaw: '신선대',
    terminal: 'SND',
    berth: 1,
    route: 'NCK',
    start: '2026-05-19T12:00:00.000Z',
    end: '2026-05-19T18:00:00.000Z',
    eta: '2026-05-19T11:00:00.000Z',
    etbInt: null,
    etdInt: null,
    etaInt: null,
    f: 18,
    e: 167,
    length: 149,
    yanghaVan: 30,
    seonjeokVan: 300,
    shiftingVan: 0,
    workHours: 6,
    planStatus: 'crane_assigned',
    ...over,
  };
}

describe('VesselHoverCard', () => {
  it('핵심 5줄 노출 — voyage / vessel / 선석 / 시간 / 상태', () => {
    renderWithProviders(<VesselHoverCard assignment={row()} anchorX={100} anchorY={100} />);
    const card = screen.getByRole('tooltip');
    expect(within(card).getByText('JKAH-6')).toBeInTheDocument();
    expect(within(card).getByText(/KAI HANG 5/)).toBeInTheDocument();
    expect(within(card).getByText('SND-1')).toBeInTheDocument();
    expect(within(card).getByText('DYS')).toBeInTheDocument();
    expect(within(card).getByText(/2026-05-19/)).toBeInTheDocument();
    // crane_assigned 라벨 = '크래인 배정 완료'
    expect(within(card).getByText('크래인 배정 완료')).toBeInTheDocument();
    expect(within(card).getByText('클릭하여 자세히 보기')).toBeInTheDocument();
  });

  it('planStatus null → 미지정 라벨 표시', () => {
    renderWithProviders(
      <VesselHoverCard assignment={row({ planStatus: null })} anchorX={100} anchorY={100} />,
    );
    expect(screen.getByText('미지정')).toBeInTheDocument();
  });

  it('vessel/company 비어있어도 깨지지 않고 - 로 표시', () => {
    renderWithProviders(
      <VesselHoverCard
        assignment={row({ vessel: '', company: '' })}
        anchorX={100}
        anchorY={100}
      />,
    );
    const card = screen.getByRole('tooltip');
    // company 줄: 값이 '-' 로 표시
    expect(within(card).getAllByText('-').length).toBeGreaterThan(0);
  });

  it('issues 제공 시 ⚠ 카운트 + 첫 메시지 노출', () => {
    renderWithProviders(
      <VesselHoverCard
        assignment={row()}
        anchorX={100}
        anchorY={100}
        issues={['berth 위치 충돌', '선석 범위 초과']}
      />,
    );
    expect(screen.getByText(/⚠ 2개 이슈/)).toBeInTheDocument();
    // 첫 번째 메시지만 표시 (간이 표시)
    expect(screen.getByText('berth 위치 충돌')).toBeInTheDocument();
    expect(screen.queryByText('선석 범위 초과')).not.toBeInTheDocument();
  });

  it('issues 빈 배열이면 ⚠ 노출 X', () => {
    renderWithProviders(
      <VesselHoverCard assignment={row()} anchorX={100} anchorY={100} issues={[]} />,
    );
    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
  });

  it('anchor 위치는 카드 style 의 left/top 으로 반영 (기본 +14 오프셋)', () => {
    renderWithProviders(<VesselHoverCard assignment={row()} anchorX={200} anchorY={300} />);
    const card = screen.getByRole('tooltip') as HTMLElement;
    // jsdom 은 getBoundingClientRect 가 0 을 반환해 reflow 가 일어나지 않음 →
    // initial position state 그대로 (200+14, 300+14) 가 적용된다.
    expect(card.style.left).toBe('214px');
    expect(card.style.top).toBe('314px');
  });
});
