import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { getMockState, completeJob } from '@/test/handlers';
import { renderWithProviders } from '@/test/renderWithProviders';

import Dashboard from './Dashboard';

describe('<Dashboard /> integration', () => {
  it('전체 흐름: 샘플 적재 → 솔버 실행 → 폴링 → 결과 비교 슬롯 자동 좌측 배치', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    // 헤더가 보인다.
    expect(
      await screen.findByRole('heading', { name: /선석 배정 양자 최적화/ }),
    ).toBeInTheDocument();

    // 1) 샘플 BPT 적재.
    await user.click(screen.getByRole('button', { name: /샘플 3척 적재/ }));
    await waitFor(() => {
      expect(screen.getByText('D-1')).toBeInTheDocument();
      expect(screen.getByText('D-3')).toBeInTheDocument();
    });

    // 2) 솔버 제출.
    const submitBtn = await screen.findByRole('button', { name: /최적화 실행/ });
    await waitFor(() => expect(submitBtn).toBeEnabled());
    await user.click(submitBtn);

    // 3) JobProgressCard 가 떠야 한다.
    expect(await screen.findByText('진행 상태')).toBeInTheDocument();

    // 4) 백엔드를 succeeded 로 전환.
    const jobIds = Array.from(getMockState().jobs.keys());
    expect(jobIds.length).toBe(1);
    const jobId = jobIds[0]!;
    completeJob(jobId);

    // 5) 폴링이 succeeded 를 잡으면 status badge 가 "완료" 로 바뀐다.
    await waitFor(
      () => {
        const completedBadges = screen.queryAllByText('완료');
        // JobProgressCard, JobsListPanel, ResultGantt 헤더 등에서 여러 곳에 등장 가능.
        expect(completedBadges.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 },
    );

    // 6) Plotly mock 이 한 trace 이상으로 렌더된다 — 좌측 슬롯이 자동 배치되어야 함.
    await waitFor(() => {
      const plots = screen.getAllByTestId('plotly-mock');
      // 좌측은 결과 데이터(1 trace), 우측은 빈 상태(empty 메시지)이므로 plot 1개만.
      const withTrace = plots.filter((el) => Number(el.dataset.traceCount ?? 0) > 0);
      expect(withTrace.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('초기 상태에서 진행 카드는 placeholder 를 표시한다', async () => {
    renderWithProviders(<Dashboard />);
    expect(
      await screen.findByText(/제출된 작업이 없습니다.*진행 상태가 여기에 표시됩니다/),
    ).toBeInTheDocument();
  });
});
