import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uploadBptRecords } from '@/shared/api/bpt.api';
import { DEMO_BPT_RECORDS } from '@/features/bpt/sample';
import { renderWithProviders } from '@/test/renderWithProviders';

import { SolverPanel } from './SolverPanel';

describe('<SolverPanel />', () => {
  it('BPT 가 비어 있으면 제출 버튼 disabled + 안내 표시', async () => {
    renderWithProviders(<SolverPanel onSubmitted={() => {}} />);
    const btn = await screen.findByRole('button', { name: /최적화 실행/ });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/BPT 데이터를 먼저 적재하세요/)).toBeInTheDocument();
  });

  it('BPT 가 있으면 제출 → onSubmitted 가 job_id 와 함께 호출된다', async () => {
    await uploadBptRecords(DEMO_BPT_RECORDS);

    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    renderWithProviders(<SolverPanel onSubmitted={onSubmitted} />);

    const btn = await screen.findByRole('button', { name: /최적화 실행/ });
    await waitFor(() => expect(btn).toBeEnabled());

    await user.click(btn);

    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalledTimes(1);
      const arg = onSubmitted.mock.calls[0]?.[0];
      expect(typeof arg).toBe('string');
      expect(arg as string).toMatch(/^job-/);
    });
  });

  it('solver 라디오 클릭 시 선택이 바뀐다', async () => {
    await uploadBptRecords(DEMO_BPT_RECORDS);

    const user = userEvent.setup();
    renderWithProviders(<SolverPanel onSubmitted={() => {}} />);

    const cqm = await screen.findByRole('radio', { name: 'cqm' });
    await user.click(cqm);
    expect(cqm).toBeChecked();

    const hybrid = screen.getByRole('radio', { name: 'hybrid' });
    await user.click(hybrid);
    expect(hybrid).toBeChecked();
    expect(cqm).not.toBeChecked();
  });
});
