import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { submitOptimizeJob } from '@/shared/api/jobs.api';
import { completeJob } from '@/test/handlers';
import { renderWithProviders } from '@/test/renderWithProviders';

import { JobsListPanel } from './JobsListPanel';

describe('<JobsListPanel />', () => {
  it('비어 있을 때 안내 문구를 표시한다', async () => {
    renderWithProviders(
      <JobsListPanel
        leftJobId={null}
        rightJobId={null}
        onSelectLeft={() => {}}
        onSelectRight={() => {}}
      />,
    );
    expect(await screen.findByText(/아직 제출된 작업이 없습니다/)).toBeInTheDocument();
  });

  it('완료된 작업의 좌/우 버튼은 enabled, running 작업은 disabled', async () => {
    const finished = await submitOptimizeJob({
      bpt_records: [],
      solver: 'gurobi',
      planning_start_time: 0,
    });
    completeJob(finished.job_id);

    const running = await submitOptimizeJob({
      bpt_records: [],
      solver: 'cqm',
      planning_start_time: 0,
    });

    renderWithProviders(
      <JobsListPanel
        leftJobId={null}
        rightJobId={null}
        onSelectLeft={() => {}}
        onSelectRight={() => {}}
      />,
    );

    // 두 작업 행이 다 그려질 때까지 대기.
    await waitFor(() => {
      const tableButtons = screen.getAllByRole('button', { name: /^[좌우]$/ });
      expect(tableButtons.length).toBe(4);
    });

    // 좌/우 버튼은 작업당 한 쌍씩 그려진다.
    // 완료된 작업과 running 작업의 enabled/disabled 가 다르다.
    const enabled = screen
      .getAllByRole('button', { name: /^[좌우]$/ })
      .filter((b) => !(b as HTMLButtonElement).disabled);
    const disabled = screen
      .getAllByRole('button', { name: /^[좌우]$/ })
      .filter((b) => (b as HTMLButtonElement).disabled);

    expect(enabled.length).toBe(2);
    expect(disabled.length).toBe(2);

    // sanity: jobId 가 표시되어 있어야 한다 (truncated).
    expect(screen.getByText(new RegExp(finished.job_id.slice(0, 6)))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(running.job_id.slice(0, 6)))).toBeInTheDocument();
  });

  it('좌 버튼 클릭 시 onSelectLeft 가 jobId 와 호출된다', async () => {
    const finished = await submitOptimizeJob({
      bpt_records: [],
      solver: 'gurobi',
      planning_start_time: 0,
    });
    completeJob(finished.job_id);

    const onSelectLeft = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <JobsListPanel
        leftJobId={null}
        rightJobId={null}
        onSelectLeft={onSelectLeft}
        onSelectRight={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^좌$/ }).length).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: /^좌$/ }));
    expect(onSelectLeft).toHaveBeenCalledWith(finished.job_id);
  });
});
