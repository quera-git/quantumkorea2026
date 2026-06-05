import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { Download, History, Inbox, Loader2 } from 'lucide-react';

import { useEditorStore } from '@/features/editor/editor.store';
import { deriveReferenceTime, stitchResult } from '@/features/solver-adapter/adapter';
import { extractErrorMessage } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/queryKeys';
import { getJobResult } from '@/shared/api/results.api';
import type { Assignment } from '@/shared/domain/types';
import { scheduleEntryToAssignment } from '@/shared/domain/vesselAdapters';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Skeleton, SkeletonStack } from '@/shared/ui/Skeleton';
import { Stack } from '@/shared/ui/Stack';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useToast } from '@/shared/ui/Toast';

import { useJobsList } from './jobs.queries';

const ScrollArea = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  background: theme.color.surface,
  maxHeight: 320,
  overflowY: 'auto',
}));

const Table = styled.table(({ theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: theme.font.size.sm,

  thead: {
    background: theme.color.surfaceAlt,
    position: 'sticky',
    top: 0,
  },
  th: {
    fontWeight: theme.font.weight.semibold,
    color: theme.color.textMuted,
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.color.border}`,
    whiteSpace: 'nowrap',
    fontSize: theme.font.size.xs,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
  },
  td: {
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.color.borderSubtle}`,
    whiteSpace: 'nowrap',
    transition: `background ${theme.motion.duration.fast} ${theme.motion.easing.standard}`,
  },
  'tbody tr:last-of-type td': {
    borderBottom: 'none',
  },
  'tbody tr:hover td': {
    background: theme.color.surfaceAlt,
  },
  'tr.selected td': {
    background: theme.color.primarySoft,
  },
  'td.mono': {
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
  },
}));

const ErrorBox = styled.div(({ theme }) => ({
  padding: theme.spacing(2),
  background: theme.color.dangerSoft,
  border: `1px solid ${theme.color.danger}33`,
  borderRadius: theme.radius.md,
  color: theme.color.danger,
  fontSize: theme.font.size.sm,
}));

interface Props {
  leftJobId: string | null;
  rightJobId: string | null;
  onSelectLeft: (jobId: string) => void;
  onSelectRight: (jobId: string) => void;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export function JobsListPanel({ leftJobId, rightJobId, onSelectLeft, onSelectRight }: Props) {
  const list = useJobsList();
  const jobs = list.data ?? [];
  const qc = useQueryClient();
  const setResult = useEditorStore((s) => s.setResult);
  const originalRows = useEditorStore((s) => s.originalRows);
  const toast = useToast();

  /**
   * BPT 직접 워크플로의 완료된 job 결과를 시나리오 + 편집의 '솔버 결과' 탭으로 흘려보냄.
   * editor.store.lastResult 에 적재 → ScenarioPanel 의 솔버 결과/비교 탭에서 사용 가능.
   *
   * 풍부 stitch:
   *   - editor.store.originalRows (활성 시나리오 snapshot) 가 있으면 stitchResult 로
   *     vessel_id ↔ voyage 매칭 → voyage/vessel/company/route/planStatus/sectionRaw 복원.
   *   - originalRows 비어있으면 (시나리오 미활성 상태) scheduleEntryToAssignment fallback —
   *     vessel_id 만 채워진 단순 Assignment.
   */
  async function loadIntoEditor(jobId: string, solver: 'gurobi' | 'cqm' | 'hybrid') {
    try {
      const data = await qc.fetchQuery({
        queryKey: queryKeys.jobs.result(jobId),
        queryFn: () => getJobResult(jobId),
        staleTime: 4_000,
      });

      let rows: Assignment[];
      let unmatched: string[] = [];
      let referenceIso: string;

      // 풍부 stitch 시도 — 활성 시나리오 rows 와 vessel_id 매칭.
      // 단, 매칭률 0% 면 (= 다른 시나리오의 job 이거나 시나리오 미활성) fallback 으로
      // schedule 그대로 표시. 차트는 어떻게든 보이게.
      //
      // ⚠ scheduleEntryToAssignment 의 3번째 인자(ref) 가 필수 —
      //    안 넘기면 start/end/eta 가 모두 null → 차트 빈 화면 + 편집기 제출 시 검증 실패.
      //    시나리오 활성 시 그 reference 사용, 미활성이면 현재 시각으로.
      if (originalRows.length > 0) {
        const ref = deriveReferenceTime(originalRows);
        const stitched = stitchResult(data.schedule, originalRows, ref);
        if (stitched.rows.length > 0) {
          // 일부라도 매칭됨 — 풍부 stitch 결과 사용.
          rows = stitched.rows;
          unmatched = stitched.unmatched;
          referenceIso = ref.toISOString();
        } else {
          // 매칭률 0% — 활성 시나리오와 무관한 job. fallback (시나리오 ref 재활용).
          rows = data.schedule.map((s, i) => scheduleEntryToAssignment(s, i, ref));
          referenceIso = ref.toISOString();
        }
      } else {
        // 시나리오 미활성 — 현재 시각을 ref 로.
        const ref = new Date();
        rows = data.schedule.map((s, i) => scheduleEntryToAssignment(s, i, ref));
        referenceIso = ref.toISOString();
      }

      setResult({
        jobId,
        solver,
        rows,
        referenceIso,
        unmatched,
        objectiveValue: data.objective_value ?? null,
        elapsedSeconds: data.elapsed_seconds ?? null,
        storedAt: new Date().toISOString(),
      });

      const stitchedNote =
        unmatched.length === 0 && originalRows.length > 0 && rows.length > 0
          ? `${rows.length}척 stitch 완료 (풍부 메타 포함)`
          : originalRows.length > 0 && unmatched.length === rows.length
            ? `${rows.length}척 (활성 시나리오와 vessel_id 매칭 X — 단순 불러옴)`
            : `${rows.length}척${unmatched.length > 0 ? ` (매칭 X ${unmatched.length}척)` : ''}`;
      toast.notify({
        tone: 'success',
        title: '솔버 결과를 시나리오 편집기로 불러왔습니다',
        description: `${stitchedNote} — '시나리오 + 편집' 의 '솔버 결과' / '비교' 탭에서 확인 가능.`,
      });
    } catch (e) {
      toast.notify({
        tone: 'danger',
        title: '결과 불러오기 실패',
        description: extractErrorMessage(e),
      });
    }
  }

  return (
    <Card>
      <SectionHeader
        icon={History}
        number="03"
        title="작업 이력"
        description="완료된 작업의 결과를 좌/우 비교 슬롯에 선택해 두 결과를 나란히 비교하세요."
        aside={
          list.isFetching ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Loader2 size={11} aria-hidden="true" /> 갱신 중
            </span>
          ) : null
        }
      />

      {list.error && <ErrorBox>{extractErrorMessage(list.error)}</ErrorBox>}

      {list.isLoading ? (
        <SkeletonStack>
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </SkeletonStack>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="아직 제출된 작업이 없습니다"
          description="좌측 02 패널에서 솔버를 실행하면 작업 이력이 여기에 쌓입니다."
        />
      ) : (
        <ScrollArea>
          <Table>
            <thead>
              <tr>
                <th>job_id</th>
                <th>solver</th>
                <th>status</th>
                <th>obj.</th>
                <th>elapsed</th>
                <th>started</th>
                <th>비교</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const isLeft = leftJobId === j.job_id;
                const isRight = rightJobId === j.job_id;
                const finished = j.status === 'succeeded';
                return (
                  <tr key={j.job_id} className={isLeft || isRight ? 'selected' : ''}>
                    <td className="mono">{shortId(j.job_id)}</td>
                    <td>{j.solver}</td>
                    <td>
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="mono">{j.objective_value?.toFixed(2) ?? '-'}</td>
                    <td className="mono">
                      {j.elapsed_seconds !== null ? `${j.elapsed_seconds.toFixed(1)}s` : '-'}
                    </td>
                    <td className="mono">{formatTime(j.started_at)}</td>
                    <td>
                      <Stack direction="row" gap={1}>
                        <Button
                          size="sm"
                          variant={isLeft ? 'primary' : 'secondary'}
                          disabled={!finished}
                          onClick={() => onSelectLeft(j.job_id)}
                        >
                          좌
                        </Button>
                        <Button
                          size="sm"
                          variant={isRight ? 'primary' : 'secondary'}
                          disabled={!finished}
                          onClick={() => onSelectRight(j.job_id)}
                        >
                          우
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!finished}
                          onClick={() => loadIntoEditor(j.job_id, j.solver)}
                          aria-label={`작업 ${shortId(j.job_id)} 결과를 시나리오 편집기로 불러오기`}
                          title="시나리오 + 편집의 '솔버 결과' 탭으로 불러오기"
                        >
                          <Download size={12} aria-hidden="true" />
                        </Button>
                      </Stack>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
