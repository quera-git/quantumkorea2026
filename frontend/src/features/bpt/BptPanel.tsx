import styled from '@emotion/styled';
import { Database, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

import { extractErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Skeleton, SkeletonStack } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';
import { useToast } from '@/shared/ui/Toast';
import { BPTRecordSchema, type BPTRecord } from '@/shared/types/schema';

import { useBptList, useClearBpt, useUploadBpt } from './bpt.queries';
import { BptTable } from './BptTable';
import { DEMO_BPT_RECORDS } from './sample';

const BPTArraySchema = z.array(BPTRecordSchema);

const Textarea = styled.textarea(({ theme }) => ({
  width: '100%',
  minHeight: 140,
  padding: theme.spacing(2),
  fontFamily: theme.font.mono,
  fontSize: theme.font.size.sm,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  background: theme.color.surface,
  resize: 'vertical',
  transition: `border-color ${theme.motion.duration.fast} ${theme.motion.easing.standard}, box-shadow ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,

  '&:focus-visible': {
    outline: 'none',
    borderColor: theme.color.primary,
    boxShadow: theme.shadow.focus,
  },
}));

const Hint = styled.p(({ theme }) => ({
  margin: 0,
  fontSize: theme.font.size.xs,
  color: theme.color.textMuted,
}));

const InlineError = styled.span(({ theme }) => ({
  fontSize: theme.font.size.sm,
  color: theme.color.danger,
}));

const SummaryRow = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(3),
  fontSize: theme.font.size.sm,
  color: theme.color.textMuted,
  strong: { color: theme.color.text, fontWeight: theme.font.weight.semibold },
  '& .fetching': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.color.textSubtle,
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
  },
}));

export function BptPanel() {
  const list = useBptList();
  const upload = useUploadBpt();
  const clear = useClearBpt();
  const toast = useToast();

  const [draft, setDraft] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const records: BPTRecord[] = list.data ?? [];

  function handleLoadSample() {
    setParseError(null);
    upload.mutate(DEMO_BPT_RECORDS, {
      onSuccess: (r) => toast.notify({ tone: 'success', title: `샘플 ${r.saved}척 적재 완료` }),
      onError: (e) =>
        toast.notify({ tone: 'danger', title: '샘플 적재 실패', description: extractErrorMessage(e) }),
    });
  }

  function handleParseAndUpload() {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      setParseError(`JSON 파싱 실패: ${(e as Error).message}`);
      return;
    }
    const result = BPTArraySchema.safeParse(parsed);
    if (!result.success) {
      setParseError(`스키마 불일치: ${result.error.issues[0]?.message ?? 'unknown'}`);
      return;
    }
    upload.mutate(result.data, {
      onSuccess: (r) => {
        setDraft('');
        toast.notify({ tone: 'success', title: `JSON ${r.saved}건 적재 완료` });
      },
      onError: (e) =>
        toast.notify({ tone: 'danger', title: '적재 실패', description: extractErrorMessage(e) }),
    });
  }

  function handleClear() {
    if (!confirm('적재된 BPT 레코드를 모두 삭제할까요?')) return;
    clear.mutate(undefined, {
      onSuccess: () => toast.notify({ tone: 'info', title: 'BPT 전체 삭제됨' }),
      onError: (e) =>
        toast.notify({ tone: 'danger', title: '삭제 실패', description: extractErrorMessage(e) }),
    });
  }

  return (
    <Card>
      <SectionHeader
        icon={Database}
        number="01"
        title="BPT 데이터"
        description="선석 배정 최적화에 사용할 입력 BPT 레코드. 샘플 적재 또는 JSON 으로 직접 입력."
        aside={
          list.isFetching ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Loader2 size={12} className="spin" aria-hidden="true" />
            </span>
          ) : null
        }
      />

      <Stack gap={4}>
        <SummaryRow>
          <span>
            현재 적재: <strong>{records.length}</strong>건
          </span>
          {list.isFetching && (
            <span className="fetching">
              <Loader2 size={11} aria-hidden="true" /> 갱신 중
            </span>
          )}
        </SummaryRow>

        {list.isLoading ? (
          <SkeletonStack>
            <Skeleton height={32} radius="md" />
            <Skeleton height={32} radius="md" />
            <Skeleton height={32} radius="md" />
          </SkeletonStack>
        ) : (
          <BptTable records={records} />
        )}

        <Stack direction="row" gap={2} wrap>
          <Button onClick={handleLoadSample} disabled={upload.isPending}>
            샘플 3척 적재
          </Button>
          <Button
            variant="secondary"
            onClick={handleClear}
            disabled={clear.isPending || records.length === 0}
          >
            {clear.isPending ? '삭제 중…' : '전체 삭제'}
          </Button>
        </Stack>

        <Stack gap={2}>
          <Hint>
            BPTRecord JSON 배열을 붙여넣어 직접 적재할 수도 있습니다. (vessel_id, length, eta_int,
            etb_int, etd_int, berth_position, yangha_van, seonjeok_van)
          </Hint>
          <Textarea
            placeholder='[{"vessel_id":"D-1","length":140,"eta_int":0,"etb_int":0,"etd_int":8,"berth_position":100,"yangha_van":30,"seonjeok_van":30}]'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label="BPT JSON 입력"
          />
          <Stack direction="row" gap={2} align="center" wrap>
            <Button
              variant="secondary"
              onClick={handleParseAndUpload}
              disabled={!draft.trim() || upload.isPending}
            >
              {upload.isPending ? '적재 중…' : 'JSON 적재'}
            </Button>
            {parseError && <InlineError role="alert">{parseError}</InlineError>}
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}
