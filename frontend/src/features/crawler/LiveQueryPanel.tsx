import styled from '@emotion/styled';
import { Database, Loader2, RefreshCw, Satellite } from 'lucide-react';
import { useState } from 'react';

import { extractErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import type { TerminalFilter } from '@/features/search/searchFilter';

import { useCrawlerPreviewAndStore, useCrawlerRefresh } from './crawler.queries';
import { useLiveScenarioStore } from './liveScenarioStore';
import { terminalToBackendBerth } from './mapping';

const Bar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(3),
  flexWrap: 'wrap',
  padding: theme.spacing(3),
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,

  '& .title': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
  },
  '& .hint': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    fontFamily: theme.font.mono,
  },
  '& .live': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    color: theme.color.textMuted,
    marginLeft: 'auto',
  },
  '& .dot': {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: theme.color.success,
  },
}));

const Field = styled.div(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontSize: theme.font.size.xs,
  color: theme.color.textMuted,

  '& select': {
    padding: '4px 8px',
    fontSize: theme.font.size.sm,
    fontFamily: theme.font.mono,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    background: theme.color.surface,
    color: theme.color.text,
  },
  '& select:focus-visible': {
    outline: 'none',
    borderColor: theme.color.primary,
    boxShadow: theme.shadow.focus,
  },
}));

const TIME_OPTIONS: { value: string; label: string }[] = [
  { value: '3days', label: '최근 4일' },
  { value: 'week', label: '최근 1주' },
  { value: 'month', label: '최근 1개월' },
];

const ROUTE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: '전체 항로' },
  { value: 'EA', label: '동남아' },
  { value: 'JP', label: '일본' },
  { value: 'CN', label: '중국' },
];

const TERMINAL_OPTIONS: { value: TerminalFilter; label: string }[] = [
  { value: 'SND', label: '신선대 SND' },
  { value: 'GAM', label: '감만 GAM' },
];

export function LiveQueryPanel() {
  const [time, setTime] = useState<string>('3days');
  const [route, setRoute] = useState<string>('ALL');
  const [terminal, setTerminal] = useState<TerminalFilter>('SND');
  const [confirmKind, setConfirmKind] = useState<'preview' | 'refresh' | null>(null);

  const preview = useCrawlerPreviewAndStore();
  const refresh = useCrawlerRefresh();
  const live = useLiveScenarioStore((s) => s.current);
  const clearLive = useLiveScenarioStore((s) => s.clearLive);
  const toast = useToast();

  const isBusy = preview.isPending || refresh.isPending;
  const backendBerth = terminalToBackendBerth(terminal);

  function requestPreview() {
    setConfirmKind('preview');
  }
  function requestRefresh() {
    setConfirmKind('refresh');
  }

  function doConfirm() {
    if (confirmKind === 'preview') {
      preview.mutate(
        { time, route, berth: backendBerth, skipVsfinder: true, limit: 500 },
        {
          onSuccess: (slice) =>
            toast.notify({
              tone: 'success',
              title: '라이브 시나리오 로드 완료',
              description: `${slice.rows.length}척 (crawled=${slice.meta.crawled}, dropped=${slice.meta.droppedInConversion})`,
            }),
          onError: (err) =>
            toast.notify({
              tone: 'danger',
              title: '라이브 조회 실패',
              description: extractErrorMessage(err),
            }),
        },
      );
    } else if (confirmKind === 'refresh') {
      refresh.mutate(
        { time, route, berth: backendBerth, replace: true },
        {
          onSuccess: (r) =>
            toast.notify({
              tone: 'success',
              title: 'BPT 테이블 갱신 완료',
              description: `crawled=${r.crawled}, saved=${r.saved}, skipped=${r.skipped}`,
            }),
          onError: (err) =>
            toast.notify({
              tone: 'danger',
              title: 'BPT refresh 실패',
              description: extractErrorMessage(err),
            }),
        },
      );
    }
    setConfirmKind(null);
  }

  return (
    <Bar role="region" aria-label="라이브 BPTC 조회">
      <span className="title">
        <Satellite size={14} aria-hidden="true" />
        라이브 BPTC
      </span>

      <Field>
        <label htmlFor="live-time">기간</label>
        <select
          id="live-time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={isBusy}
        >
          {TIME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field>
        <label htmlFor="live-route">항로</label>
        <select
          id="live-route"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          disabled={isBusy}
        >
          {ROUTE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field>
        <label htmlFor="live-terminal">터미널</label>
        <select
          id="live-terminal"
          value={terminal}
          onChange={(e) => setTerminal(e.target.value as TerminalFilter)}
          disabled={isBusy}
        >
          {TERMINAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Button
        variant="secondary"
        size="sm"
        onClick={requestPreview}
        disabled={isBusy}
        title="BPTC 사이트를 크롤링해 풍부 시나리오로 변환. DB 저장 X."
      >
        {preview.isPending ? <Loader2 size={12} aria-hidden="true" /> : <Satellite size={12} aria-hidden="true" />}
        라이브 시나리오 로드
      </Button>

      <Button
        size="sm"
        onClick={requestRefresh}
        disabled={isBusy}
        title="BPTC 크롤링 + BPT 테이블 영속화. 우측 BptPanel 자동 갱신."
      >
        {refresh.isPending ? <Loader2 size={12} aria-hidden="true" /> : <Database size={12} aria-hidden="true" />}
        BPT 테이블 refresh
      </Button>

      {live && (
        <span className="live" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {live.label} · {live.rows.length}척
          <Button variant="ghost" size="sm" onClick={clearLive} aria-label="라이브 시나리오 비우기">
            <RefreshCw size={11} aria-hidden="true" />
          </Button>
        </span>
      )}

      <ConfirmDialog
        open={confirmKind !== null}
        tone="warning"
        title={confirmKind === 'preview' ? '라이브 시나리오 조회' : 'BPT 테이블 refresh'}
        description={
          confirmKind === 'preview' ? (
            <>
              BPTC 사이트(info.bptc.co.kr) 를 실시간으로 크롤링합니다. 10~30초 소요.
              <br />
              결과는 DB 에 저장하지 않고 라이브 시나리오로만 등록됩니다.
            </>
          ) : (
            <>
              BPTC 사이트를 크롤링해 <strong>BPT 테이블 전체를 교체</strong>합니다. 우측 BPT
              패널이 자동 갱신되고, 그 뒤로 모든 솔버 제출이 이 데이터를 입력으로 사용합니다.
              <br />
              <br />
              <strong>주의</strong>: 기존 BPT 데이터는 삭제됩니다 (replace=true).
            </>
          )
        }
        detail={
          <>
            time = <strong>{time}</strong> / route = <strong>{route}</strong> / berth ={' '}
            <strong>
              {terminal} ({backendBerth})
            </strong>
          </>
        }
        confirmLabel={confirmKind === 'preview' ? '조회' : '교체'}
        cancelLabel="취소"
        onConfirm={doConfirm}
        onCancel={() => setConfirmKind(null)}
      />
    </Bar>
  );
}
