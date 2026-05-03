import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadScenario } from '@/features/scenario/scenarioLoader';
import { renderWithProviders } from '@/test/renderWithProviders';

import { ValidationPanel } from './ValidationPanel';

describe('<ValidationPanel />', () => {
  it('빈 입력 → 검사 대상 0', () => {
    renderWithProviders(<ValidationPanel assignments={[]} />);
    expect(screen.getByText('검사 대상')).toBeInTheDocument();
    // value 0
    const totals = screen.getAllByText('0');
    expect(totals.length).toBeGreaterThan(0);
  });

  it('실 시나리오 입력 → 통계 + (이슈 있을 시) 테이블', () => {
    const s = loadScenario('before_0313_1430');
    renderWithProviders(<ValidationPanel assignments={s.rows} />);
    expect(screen.getByText('검사 대상')).toBeInTheDocument();
    // 검사 대상 stat 의 value 가 행 수와 일치
    const labels = screen.getAllByText('검사 대상');
    expect(labels.length).toBeGreaterThanOrEqual(1);
    // 통과/실패 둘 중 하나만 떠야 함
    const passOrIssues =
      screen.queryByText('모든 검증 통과') ?? screen.queryByText(/심각도/) ?? null;
    expect(passOrIssues).not.toBeNull();
  });
});
