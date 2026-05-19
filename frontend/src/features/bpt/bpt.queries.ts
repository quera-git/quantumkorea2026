import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearBptRecords, listBptRecords, uploadBptRecords } from '@/shared/api/bpt.api';
import { queryKeys } from '@/shared/api/queryKeys';
import type { BPTRecord } from '@/shared/types/schema';

export function useBptList() {
  return useQuery({
    queryKey: queryKeys.bpt.list,
    queryFn: listBptRecords,
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
