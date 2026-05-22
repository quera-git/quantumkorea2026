// 시나리오 업로드 예시 파일 다운로드 메뉴.
//
// public/samples/index.json 을 처음 열 때 한 번만 fetch (lazy). 시나리오 × 포맷 그리드로
// 노출. 각 셀은 a[href] 직접 다운로드 (정적 자산, backend 거치지 않음).
//
// UX: 작은 outline 칩 → 클릭 시 우측 popover. ESC / 바깥 클릭으로 닫힘.

import styled from '@emotion/styled';
import { Download, FileJson, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/shared/ui/Button';

interface SampleFile {
  format: 'payload' | 'raw' | 'xlsx';
  file: string;
  label: string;
}
interface SampleScenario {
  id: string;
  label: string;
  description: string;
  rowCount: number;
  files: SampleFile[];
}
interface SampleIndex {
  scenarios: SampleScenario[];
}

const Anchor = styled.div({
  position: 'relative',
  display: 'inline-block',
});

const Popover = styled.div(({ theme }) => ({
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  width: 'min(420px, calc(100vw - 32px))',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.lg,
  padding: theme.spacing(3),
  zIndex: theme.z.dropdown,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const Heading = styled.div(({ theme }) => ({
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  lineHeight: theme.font.lineHeight.normal,
  '& strong': { color: theme.color.text, fontWeight: theme.font.weight.semibold },
}));

const ScenarioBlock = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.color.borderSubtle}`,
  borderRadius: theme.radius.md,
  background: theme.color.surfaceAlt,
}));

const ScenarioHead = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: theme.spacing(2),
  '& .label': {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
  },
  '& .count': {
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    color: theme.color.textSubtle,
  },
  '& .desc': {
    fontSize: theme.font.size.xs,
    color: theme.color.textMuted,
    marginLeft: 'auto',
    textAlign: 'right',
  },
}));

const FormatRow = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
}));

const FormatLink = styled.a(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: '4px 10px',
  fontSize: theme.font.size.xs,
  fontFamily: theme.font.mono,
  color: theme.color.text,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.pill,
  textDecoration: 'none',
  cursor: 'pointer',
  '&:hover': {
    background: theme.color.primarySoft,
    borderColor: theme.color.primary,
    color: theme.color.primary,
  },
  '&:focus-visible': { outline: 'none', boxShadow: theme.shadow.focus },
}));

const ErrorNote = styled.div(({ theme }) => ({
  fontSize: theme.font.size.xs,
  color: theme.color.danger,
}));

function formatIcon(format: SampleFile['format']) {
  if (format === 'xlsx') return <FileSpreadsheet size={12} aria-hidden="true" />;
  if (format === 'payload') return <FileJson size={12} aria-hidden="true" />;
  return <FileText size={12} aria-hidden="true" />;
}

function formatShortLabel(format: SampleFile['format']) {
  if (format === 'xlsx') return '엑셀';
  if (format === 'payload') return '풍부 JSON';
  return '한글 raw JSON';
}

export function SampleDownloadMenu() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SampleIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 처음 열 때만 fetch.
  useEffect(() => {
    if (!open || data || error) return;
    let cancelled = false;
    fetch('/samples/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SampleIndex>;
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(`예시 목록을 불러올 수 없습니다 (${(e as Error).message}).`);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data, error]);

  // 바깥 클릭 / ESC 닫기.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Anchor ref={wrapRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="업로드 형식 예시 파일 다운로드"
      >
        <Sparkles size={12} aria-hidden="true" /> 예시
      </Button>

      {open && (
        <Popover role="dialog" aria-label="예시 시나리오 다운로드">
          <Heading>
            업로드 형식을 확인할 수 있는 <strong>예시 파일</strong>입니다. 다운로드 후 그대로
            업로드하면 흐름을 시험해볼 수 있어요.
          </Heading>

          {error && <ErrorNote role="alert">{error}</ErrorNote>}

          {!data && !error && <Heading>로딩 중…</Heading>}

          {data?.scenarios.map((s) => (
            <ScenarioBlock key={s.id}>
              <ScenarioHead>
                <span className="label">{s.label}</span>
                <span className="count">{s.rowCount}척</span>
                <span className="desc">{s.description}</span>
              </ScenarioHead>
              <FormatRow>
                {s.files.map((f) => (
                  <FormatLink
                    key={f.file}
                    href={`/samples/${f.file}`}
                    download={f.file}
                    title={f.label}
                  >
                    {formatIcon(f.format)}
                    {formatShortLabel(f.format)}
                    <Download size={10} aria-hidden="true" />
                  </FormatLink>
                ))}
              </FormatRow>
            </ScenarioBlock>
          ))}
        </Popover>
      )}
    </Anchor>
  );
}
