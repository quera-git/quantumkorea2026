import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearBptRecords, listBptRecords, uploadBptRecords } from '@/shared/api/bpt.api';
import { queryKeys } from '@/shared/api/queryKeys';
import type { BPTRecord } from '@/shared/types/schema';

export function useBptList() {
  return useQuery({
    queryKey: queryKeys.bpt.list,
    queryFn: listBptRecords,
    // BPT 는 mutation(upload/clear) 후 명시적으로 invalidate 함 → 자동 refetch 는 10s
    // 까지 캐시 사용해 탭 전환 시 깜빡임 줄임.
    staleTime: 10_000,
  });
}

export function useUploadBpt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: BPTRecord[]) => uploadBptRecords(records),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bpt.list }),
  });
}

export function useClearBpt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearBptRecords(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bpt.list }),
  });
}
