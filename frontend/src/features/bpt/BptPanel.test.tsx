import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';

import { BptPanel } from './BptPanel';

describe('<BptPanel />', () => {
  it('초기 상태: 적재 0건 + 비어있다는 메시지', async () => {
    renderWithProviders(<BptPanel />);
    expect(await screen.findByText(/적재된 BPT 레코드가 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/현재 적재:/)).toBeInTheDocument();
  });

  it('샘플 3척 적재 버튼을 누르면 테이블에 3행이 표시된다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BptPanel />);

    await user.click(screen.getByRole('button', { name: /샘플 3척 적재/ }));

    await waitFor(() => {
      expect(screen.getByText('D-1')).toBeInTheDocument();
      expect(screen.getByText('D-2')).toBeInTheDocument();
      expect(screen.getByText('D-3')).toBeInTheDocument();
    });
  });

  it('JSON 적재: 빈 텍스트면 버튼이 disabled', () => {
    renderWithProviders(<BptPanel />);
    const btn = screen.getByRole('button', { name: /JSON 적재/ });
    expect(btn).toBeDisabled();
  });

  it('JSON 적재: 잘못된 JSON 입력 시 파싱 에러 메시지', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BptPanel />);

    // userEvent 의 type 은 `{` 가 special char 라 JSON 입력에 부담이 크다.
    // 단순 텍스트는 type, JSON 페이로드는 fireEvent.change 로 넣는다.
    const ta = screen.getByPlaceholderText(/D-1/);
    await user.type(ta, 'not-json');

    await user.click(screen.getByRole('button', { name: /JSON 적재/ }));

    expect(await screen.findByText(/JSON 파싱 실패/)).toBeInTheDocument();
  });

  it('JSON 적재: 스키마 불일치 시 에러 표시', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BptPanel />);

    const ta = screen.getByPlaceholderText(/D-1/);
    // length 누락. fireEvent.change 로 textarea value 직접 주입.
    fireEvent.change(ta, { target: { value: '[{"vessel_id":"X"}]' } });
    await user.click(screen.getByRole('button', { name: /JSON 적재/ }));

    expect(await screen.findByText(/스키마 불일치/)).toBeInTheDocument();
  });
});
