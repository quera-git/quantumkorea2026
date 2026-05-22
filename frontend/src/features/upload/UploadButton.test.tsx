import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';

import { UploadButton } from './UploadButton';
import { useUploadedScenarioStore } from './uploadedScenarioStore';

function reset() {
  useUploadedScenarioStore.setState({ scenarios: [] });
  if (typeof localStorage !== 'undefined') localStorage.removeItem('uploaded-scenarios');
}

function getHiddenInput(): HTMLInputElement {
  // 화면 외 hidden input — querySelector 로 직접 잡음.
  const el = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (!el) throw new Error('hidden file input not found');
  return el;
}

describe('UploadButton', () => {
  beforeEach(reset);
  afterEach(reset);

  it('버튼 렌더 + 클릭 시 hidden input 트리거 (단순 마운트 검증)', () => {
    renderWithProviders(<UploadButton />);
    expect(screen.getByRole('button', { name: /시나리오 파일 업로드/ })).toBeInTheDocument();
    const input = getHiddenInput();
    expect(input.accept).toMatch(/json/);
    expect(input.accept).toMatch(/xlsx/);
  });

  it('정상 JSON 파일 선택 → UploadDialog 열림', async () => {
    renderWithProviders(<UploadButton />);
    const input = getHiddenInput();
    const file = new File(
      [
        JSON.stringify([
          {
            구분: '신선대',
            선석: '1',
            모선항차: 'A',
            입항일시: '2026/05/19 00:00',
            작업완료일시: '2026/05/19 08:00',
            f: 0,
            e: 200,
          },
        ]),
      ],
      'sample.json',
      { type: 'application/json' },
    );
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('지원 안 되는 확장자 → warning toast + dialog 안 뜸', async () => {
    renderWithProviders(<UploadButton />);
    const input = getHiddenInput();
    const bad = new File(['hello'], 'note.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [bad] } });
    // toast region 안에 메시지 떠야 함
    await waitFor(() => {
      expect(screen.getByText(/지원하지 않는 확장자/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('파일 크기 10MB 초과 → danger toast', async () => {
    renderWithProviders(<UploadButton />);
    const input = getHiddenInput();
    // 11MB 크기 dummy File.
    const big = new File(['x'.repeat(11 * 1024 * 1024)], 'big.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [big] } });
    await waitFor(() => {
      expect(screen.getByText(/파일이 너무 큽니다/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('드래그앤드롭으로도 파일 등록 (드롭 영역)', async () => {
    renderWithProviders(<UploadButton />);
    const button = screen.getByRole('button', { name: /시나리오 파일 업로드/ });
    const dropTarget = button.parentElement as HTMLElement; // Wrap div
    const file = new File(
      [
        JSON.stringify([
          {
            구분: '신선대',
            선석: '1',
            모선항차: 'A',
            입항일시: '2026/05/19 00:00',
            작업완료일시: '2026/05/19 08:00',
            f: 0,
            e: 200,
          },
        ]),
      ],
      'dropped.json',
      { type: 'application/json' },
    );
    fireEvent.drop(dropTarget, {
      dataTransfer: { files: [file], items: [], types: ['Files'] },
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
