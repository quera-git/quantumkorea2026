// 시나리오 파일(.json/.xlsx) 업로드 버튼 + 드래그앤드롭 영역.
// 파일이 선택/드롭되면 UploadDialog 가 열려 파싱 미리보기 → 확정 흐름으로 들어간다.
//
// 디자인:
//   - 평소엔 작은 secondary 버튼 (LiveQueryPanel 옆에 들어가도 부담 X).
//   - 드래그가 시작되면 (글로벌 dragover) 화면 전체에 hint border 표시 — 우리 ScenarioPanel
//     영역 어디에 떨어뜨려도 받아준다. (간단 구현: 버튼 자체 영역에서 dropover 색만 바뀜)
//
// 입력 검증:
//   - 확장자 .json / .xlsx / .xls 만.
//   - 크기 MAX_UPLOAD_BYTES 초과 시 toast 후 무시.

import styled from '@emotion/styled';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';

import { MAX_UPLOAD_BYTES } from './parsers';
import { SampleDownloadMenu } from './SampleDownloadMenu';
import { UploadDialog } from './UploadDialog';

const Wrap = styled.div<{ dragging: boolean }>(({ theme, dragging }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: dragging ? '2px' : 0,
  borderRadius: theme.radius.md,
  outline: dragging ? `2px dashed ${theme.color.primary}` : 'none',
  outlineOffset: 2,
  transition: `outline-color ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
}));

const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});

const ACCEPT = '.json,.xlsx,.xls,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

interface Props {
  /** 등록 완료 시 호출 — caller 가 활성 시나리오로 전환 등에 사용. */
  onAdded?: (scenarioId: string) => void;
}

export function UploadButton({ onAdded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();

  function validateAndSet(f: File) {
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.notify({
        tone: 'danger',
        title: '파일이 너무 큽니다',
        description: `최대 ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB 까지 가능합니다 (현재 ${(f.size / 1024 / 1024).toFixed(1)}MB).`,
      });
      return;
    }
    if (!/\.(json|xlsx?|)$/i.test(f.name)) {
      toast.notify({
        tone: 'warning',
        title: '지원하지 않는 확장자',
        description: '.json / .xlsx / .xls 파일만 업로드 가능합니다.',
      });
      return;
    }
    setFile(f);
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
    // 같은 파일을 다시 선택해도 onChange 트리거되도록 value 리셋.
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSet(f);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  return (
    <>
      <Wrap
        dragging={dragging}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Button variant="secondary" size="sm" onClick={handleClick} aria-label="시나리오 파일 업로드">
          <Upload size={12} aria-hidden="true" /> 시나리오 업로드
        </Button>
        <HiddenInput
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <SampleDownloadMenu />
      </Wrap>

      <UploadDialog
        file={file}
        onClose={() => setFile(null)}
        onAdded={(id) => {
          onAdded?.(id);
          setFile(null);
        }}
      />
    </>
  );
}
