// UploadDialog 의 파싱 → 미리보기 → 추가 흐름 통합.
//
// 파일은 jsdom 의 File 객체 (text/arrayBuffer 메서드 지원).
// xlsx 분기는 실제 install 안 됨 → "패키지 설치 필요" 에러 메시지 확인 정도만.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';

import { UploadDialog } from './UploadDialog';
import { useUploadedScenarioStore } from './uploadedScenarioStore';

function makeJsonFile(name: string, body: unknown): File {
  return new File([JSON.stringify(body)], name, { type: 'application/json' });
}

function reset() {
  useUploadedScenarioStore.setState({ scenarios: [] });
  if (typeof localStorage !== 'undefined') localStorage.removeItem('uploaded-scenarios');
}

describe('UploadDialog', () => {
  beforeEach(reset);
  afterEach(reset);

  it('file=null → 렌더 X', () => {
    renderWithProviders(<UploadDialog file={null} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('raw-rows JSON → 통계 표시 + 추가 시 store 등록', async () => {
    const onClose = vi.fn();
    const onAdded = vi.fn();
    const file = makeJsonFile('샘플-0313.json', [
      {
        구분: '신선대',
        선석: '1',
        모선항차: 'A',
        선박명: 'V',
        입항일시: '2026/05/19 00:00',
        작업완료일시: '2026/05/19 08:00',
        f: 0,
        e: 200,
      },
      {
        구분: '감만',
        선석: '7',
        모선항차: 'B',
        선박명: 'W',
        입항일시: '2026/05/19 00:00',
        작업완료일시: '2026/05/19 12:00',
        f: 0,
        e: 200,
      },
    ]);
    renderWithProviders(<UploadDialog file={file} onClose={onClose} onAdded={onAdded} />);

    // 비동기 파싱이라 waitFor.
    await waitFor(() => {
      expect(screen.getByRole('region', { name: '시나리오 통계' })).toBeInTheDocument();
    });
    const stats = screen.getByRole('region', { name: '시나리오 통계' });
    expect(stats.textContent).toMatch(/2/); // 총 2
    // SND 1 / GAM 1 도 포함되어야 함
    expect(stats.textContent).toMatch(/1/);

    // 시나리오 이름 자동 = 파일명 - 확장자
    const labelInput = screen.getByLabelText('시나리오 이름') as HTMLInputElement;
    expect(labelInput.value).toBe('샘플-0313');

    // 추가
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(onAdded).toHaveBeenCalledOnce();
    expect(useUploadedScenarioStore.getState().scenarios).toHaveLength(1);
    expect(useUploadedScenarioStore.getState().scenarios[0]?.label).toBe('샘플-0313');
  });

  it('ScenarioPayload JSON → format=scenario-payload, 그대로 등록', async () => {
    const onClose = vi.fn();
    const file = makeJsonFile('preset.json', {
      scenarioId: 'orig',
      label: 'orig-label',
      sourceFile: 'orig.xlsx',
      rowCount: 1,
      rows: [
        {
          rowId: 'r-0',
          voyage: 'A',
          terminal: 'SND',
          berth: 1,
          start: '2026-05-19T00:00:00',
          end: '2026-05-19T08:00:00',
          eta: null,
          f: 0,
          e: 200,
          length: 200,
        },
      ],
    });
    renderWithProviders(<UploadDialog file={file} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByRole('region', { name: '시나리오 통계' })).toBeInTheDocument();
    });
    expect(screen.getByText(/scenario-payload/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(useUploadedScenarioStore.getState().scenarios).toHaveLength(1);
  });

  it('잘못된 JSON → 에러 alert + 추가 버튼 disabled', async () => {
    const file = new File(['{not json}'], 'bad.json', { type: 'application/json' });
    renderWithProviders(<UploadDialog file={file} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/JSON 파싱 실패/);
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();
  });

  it('Esc → onClose', async () => {
    const onClose = vi.fn();
    const file = makeJsonFile('x.json', []);
    renderWithProviders(<UploadDialog file={file} onClose={onClose} />);
    // 파싱 후 (빈 배열 → throw "0행")
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('label 입력 → 그 이름으로 등록', async () => {
    const file = makeJsonFile('default-name.json', [
      {
        구분: '신선대',
        선석: '1',
        모선항차: 'A',
        입항일시: '2026/05/19 00:00',
        작업완료일시: '2026/05/19 08:00',
        f: 0,
        e: 200,
      },
    ]);
    renderWithProviders(<UploadDialog file={file} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByLabelText('시나리오 이름')).toBeInTheDocument();
    });
    const input = screen.getByLabelText('시나리오 이름') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '내가 지정한 이름');
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(useUploadedScenarioStore.getState().scenarios[0]?.label).toBe('내가 지정한 이름');
  });
});
