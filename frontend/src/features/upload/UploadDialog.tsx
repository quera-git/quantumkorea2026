// 업로드된 파일을 파싱 → 미리보기 → 사용자 확정 시 store 에 등록하는 모달.
//
// 흐름:
//   1) props.file 변경 → 파싱 (json/xlsx) → preview state.
//   2) 사용자가 시나리오 이름 편집 + "추가" → uploadedScenarioStore.add + onClose.
//   3) 파싱 에러 → 모달 안에 에러 표시 + 닫기만 가능.
//
// ConfirmDialog 와 같은 backdrop/모달 스타일. portal 로 body.

import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { CircleAlert, FileUp, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { validateAssignments } from '@/features/validation/validation';
import type { ScenarioPayload } from '@/shared/domain/types';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';

import {
  UploadParseError,
  fileNameToScenarioLabel,
  generateScenarioId,
  parseJsonInput,
  parseXlsxInput,
  summarizePayload,
  type DetectedFormat,
} from './parsers';
import { useUploadedScenarioStore } from './uploadedScenarioStore';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;
const slideIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const Backdrop = styled.div(({ theme }) => ({
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.42)',
  backdropFilter: 'blur(2px)',
  zIndex: theme.z.modal - 1,
  animation: `${fadeIn} ${theme.motion.duration.fast} ${theme.motion.easing.enter}`,
}));

const Dialog = styled.div(({ theme }) => ({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(520px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.lg,
  zIndex: theme.z.modal,
  animation: `${slideIn} ${theme.motion.duration.slow} ${theme.motion.easing.enter}`,
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: `${theme.spacing(4)} ${theme.spacing(5)}`,
  borderBottom: `1px solid ${theme.color.border}`,

  '& .icon': {
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    borderRadius: theme.radius.md,
    background: theme.color.primarySoft,
    color: theme.color.primary,
    flexShrink: 0,
  },
  '& h2': {
    margin: 0,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
    flex: 1,
  },
  '& .close': {
    background: 'transparent',
    border: 'none',
    color: theme.color.textSubtle,
    cursor: 'pointer',
    padding: 4,
    borderRadius: theme.radius.sm,
  },
  '& .close:hover': { background: theme.color.surfaceAlt, color: theme.color.text },
  '& .close:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

const Body = styled.div(({ theme }) => ({
  padding: theme.spacing(5),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const Field = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  '& label': {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.textMuted,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
  },
  '& input': {
    padding: '6px 10px',
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    background: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.font.size.sm,
  },
  '& input:focus-visible': {
    outline: 'none',
    borderColor: theme.color.primary,
    boxShadow: theme.shadow.focus,
  },
}));

const Stats = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  background: theme.color.surfaceAlt,
  borderRadius: theme.radius.md,

  '& .stat': { display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' },
  '& .k': {
    fontSize: 10,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
    fontWeight: theme.font.weight.semibold,
  },
  '& .v': {
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    fontFamily: theme.font.mono,
    color: theme.color.text,
  },
  '& .warn': { color: theme.color.warning },
}));

const Note = styled.div(({ theme }) => ({
  fontSize: theme.font.size.xs,
  color: theme.color.textSubtle,
  fontFamily: theme.font.mono,
  lineHeight: theme.font.lineHeight.normal,
}));

const ErrorBlock = styled.div(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  background: theme.color.dangerSoft,
  border: `1px solid ${theme.color.danger}33`,
  borderRadius: theme.radius.md,
  color: theme.color.danger,
  fontSize: theme.font.size.sm,
  lineHeight: theme.font.lineHeight.normal,

  '& svg': { flexShrink: 0, marginTop: 2 },
  '& .msg': { color: theme.color.text, wordBreak: 'break-word' },
}));

const Footer = styled.div(({ theme }) => ({
  padding: `${theme.spacing(3)} ${theme.spacing(5)} ${theme.spacing(4)}`,
  borderTop: `1px solid ${theme.color.border}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(2),
}));

interface Props {
  /** 처리할 파일. null 이면 dialog 안 뜸. */
  file: File | null;
  onClose: () => void;
  /** 등록 완료 시 호출 — caller 가 활성 시나리오 전환 등에 사용. */
  onAdded?: (scenarioId: string) => void;
}

interface ParsedState {
  payload: ScenarioPayload;
  droppedCount: number;
  format: DetectedFormat | 'xlsx';
  stats: ReturnType<typeof summarizePayload>;
  issueCount: number;
}

export function UploadDialog({ file, onClose, onAdded }: Props) {
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');

  const add = useUploadedScenarioStore((s) => s.add);
  const toast = useToast();

  // 파일 변경 시 자동 파싱.
  useEffect(() => {
    if (!file) {
      setParsed(null);
      setError(null);
      setLabelInput('');
      return;
    }
    let cancelled = false;
    const defaultLabel = fileNameToScenarioLabel(file.name);
    setLabelInput(defaultLabel);
    setError(null);
    setParsed(null);
    setParsing(true);

    (async () => {
      try {
        const isXlsx = /\.xlsx?$/i.test(file.name);
        const tempMeta = {
          id: generateScenarioId(defaultLabel),
          label: defaultLabel,
          sourceFile: file.name,
        };
        let payload: ScenarioPayload;
        let droppedCount = 0;
        let format: ParsedState['format'];
        if (isXlsx) {
          const buf = await file.arrayBuffer();
          const r = await parseXlsxInput(buf, tempMeta);
          payload = r.payload;
          droppedCount = r.droppedCount;
          format = 'xlsx';
        } else {
          const text = await file.text();
          const r = parseJsonInput(text, tempMeta);
          payload = r.payload;
          droppedCount = r.droppedCount;
          format = r.format;
        }
        if (cancelled) return;
        const stats = summarizePayload(payload);
        const issues = validateAssignments(payload.rows);
        setParsed({ payload, droppedCount, format, stats, issueCount: issues.length });
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof UploadParseError
            ? e.message
            : `예상치 못한 오류: ${(e as Error).message}`;
        setError(msg);
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Esc 닫기 + scroll lock.
  useEffect(() => {
    if (!file) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [file, onClose]);

  if (!file) return null;

  function handleConfirm() {
    if (!parsed) return;
    const label = labelInput.trim() || fileNameToScenarioLabel(file?.name ?? 'untitled');
    const id = generateScenarioId(label);
    try {
      const finalId = add({
        id,
        label,
        sourceFile: parsed.payload.sourceFile,
        rows: parsed.payload.rows,
        format: parsed.format,
        droppedInConversion: parsed.droppedCount,
      });
      toast.notify({
        tone: 'success',
        title: '시나리오 추가 완료',
        description: `${parsed.payload.rows.length}척 등록 (id=${finalId}).`,
      });
      onAdded?.(finalId);
      onClose();
    } catch (e) {
      // localStorage 한도 초과 등.
      toast.notify({
        tone: 'danger',
        title: '시나리오 저장 실패',
        description: (e as Error).message,
      });
    }
  }

  return createPortal(
    <>
      <Backdrop onClick={onClose} aria-hidden="true" />
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <Header>
          <span className="icon" aria-hidden="true">
            <FileUp size={16} strokeWidth={2} />
          </span>
          <h2 id="upload-dialog-title">시나리오 업로드 미리보기</h2>
          <button type="button" className="close" onClick={onClose} aria-label="닫기" autoFocus>
            <X size={14} aria-hidden="true" />
          </button>
        </Header>

        <Body>
          <Note>
            파일: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
          </Note>

          {parsing && (
            <Note role="status">
              <Loader2 size={12} aria-hidden="true" /> 파싱 중…
            </Note>
          )}

          {error && (
            <ErrorBlock role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <div className="msg">{error}</div>
            </ErrorBlock>
          )}

          {parsed && !error && (
            <>
              <Stats role="region" aria-label="시나리오 통계">
                <div className="stat">
                  <span className="k">총</span>
                  <span className="v">{parsed.stats.total}</span>
                </div>
                <div className="stat">
                  <span className="k">SND</span>
                  <span className="v">{parsed.stats.snd}</span>
                </div>
                <div className="stat">
                  <span className="k">GAM</span>
                  <span className="v">{parsed.stats.gam}</span>
                </div>
                <div className="stat">
                  <span className="k">검증 이슈</span>
                  <span className={`v ${parsed.issueCount > 0 ? 'warn' : ''}`}>
                    {parsed.issueCount}
                  </span>
                </div>
              </Stats>
              <Note>
                포맷: <strong>{parsed.format}</strong>
                {parsed.droppedCount > 0 && (
                  <>
                    {' '}
                    · 변환 중 누락 <strong>{parsed.droppedCount}</strong>행 (필수 컬럼 비어있음)
                  </>
                )}
                {parsed.stats.unknown > 0 && (
                  <>
                    {' '}
                    · 터미널 미확인 <strong>{parsed.stats.unknown}</strong>척
                  </>
                )}
              </Note>
              <Field>
                <label htmlFor="upload-label">시나리오 이름</label>
                <input
                  id="upload-label"
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  maxLength={80}
                  placeholder="예: 0313 14:30 (편집 전)"
                />
              </Field>
              {parsed.issueCount > 0 && (
                <Note>
                  ⚠ 검증 위반 {parsed.issueCount}건 — 추가는 가능하나 시각화에서 빨간 막대로 보임.
                </Note>
              )}
            </>
          )}
        </Body>

        <Footer>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!parsed || parsing || !!error}>
            추가
          </Button>
        </Footer>
      </Dialog>
    </>,
    document.body,
  );
}
