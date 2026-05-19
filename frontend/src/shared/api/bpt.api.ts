import { z } from 'zod';

import { BPTRecordSchema, type BPTRecord } from '@/shared/types/schema';

import { apiClient } from './client';

export interface BptUploadResponse {
  saved: number;
}

export async function uploadBptRecords(records: BPTRecord[]): Promise<BptUploadResponse> {
  const { data } = await apiClient.post<BptUploadResponse>('/bpt/', records);
  return data;
}

export async function listBptRecords(): Promise<BPTRecord[]> {
  const { data } = await apiClient.get<unknown>('/bpt/');
  // 응답이 BPTRecord 배열인지 런타임에서 한 번 검증한다 (백엔드 스키마 변경 조기 감지).
  return z.array(BPTRecordSchema).parse(data);
}

export async function clearBptRecords(): Promise<void> {
  await apiClient.delete('/bpt/');
}
