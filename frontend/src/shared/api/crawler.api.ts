// 부산항 BPTC 라이브 크롤러 라우터 client.
//   GET  /crawler/preview  — DB 저장 X, JSON 으로 raw 한글 컬럼 반환 (미리보기/풍부 변환 source)
//   POST /crawler/refresh  — 크롤링 + BPTRecord 변환 + BPT 테이블 영속화
// AGENTS.md §4.2 — 모든 호출은 단일 axios 인스턴스(apiClient) 경유.

import { z } from 'zod';

import { apiClient } from './client';

/** preview 응답의 raw row — 한글 컬럼이 그대로 들어옴. */
export const CrawlerRawRowSchema = z
  .object({
    구분: z.string().optional(),
    선석: z.union([z.string(), z.number()]).optional(),
    모선항차: z.string().optional(),
    선박명: z.string().optional(),
    접안: z.string().optional(),
    선사: z.string().optional(),
    '입항 예정일시': z.string().optional(),
    입항일시: z.string().optional(),
    작업완료일시: z.string().optional(),
    출항일시: z.string().optional(),
    '반입 마감일시': z.string().optional(),
    양하: z.union([z.string(), z.number()]).optional(),
    선적: z.union([z.string(), z.number()]).optional(),
    'S/H': z.union([z.string(), z.number()]).optional(),
    전배: z.string().optional(),
    항로: z.string().optional(),
    검역: z.string().optional(),
    bp: z.number().nullable().optional(),
    f: z.number().nullable().optional(),
    e: z.number().nullable().optional(),
    // BPTC 선석배정 그래픽(G) 의 VslMsg plan_cd raw 값.
    // L=적하완료 / D=양하완료 / C=크래인배정 / 그 외=크래인미배정 / 미게재=null.
    plan_cd: z.string().nullable().optional(),
  })
  // 백엔드가 추가 컬럼을 더 노출할 가능성 — passthrough 로 받기만 함.
  .passthrough();
export type CrawlerRawRow = z.infer<typeof CrawlerRawRowSchema>;

export const CrawlerPreviewResponseSchema = z.object({
  count: z.number(),
  columns: z.array(z.string()),
  rows: z.array(CrawlerRawRowSchema),
  params: z.record(z.string(), z.unknown()),
});
export type CrawlerPreviewResponse = z.infer<typeof CrawlerPreviewResponseSchema>;

export const CrawlerRefreshResponseSchema = z.object({
  crawled: z.number(),
  saved: z.number(),
  skipped: z.number(),
  skipped_breakdown: z
    .object({
      date_parse_failed: z.number().optional(),
      length_missing: z.number().optional(),
      bp_missing: z.number().optional(),
    })
    .optional(),
  etb_filled_from_eta: z.number().optional(),
  replace: z.boolean().optional(),
  reference_time: z.string().nullable().optional(),
});
export type CrawlerRefreshResponse = z.infer<typeof CrawlerRefreshResponseSchema>;

export interface CrawlerQueryParams {
  /** "3days" | "week" | "month" | "term". 기본 3days. */
  time: string;
  /** "ALL" | "EA" | "JP" | "CN". */
  route: string;
  /** 백엔드 enum: "A" = 신선대, "B" = 감만 (Streamlit 원본과 다름). */
  berth: string;
  skipVsfinder?: boolean;
  limit?: number;
  /**
   * time="term" 일 때 BPTC 에 전달할 직접입력 구간 (YYYY-MM-DD).
   * backend 가 ISO date 두 개 (start_date, end_date) 로 받아 BPTC 사이트의
   * YEAR1/MONTH1/DAY1 + YEAR2/MONTH2/DAY2 폼으로 분해 forward.
   */
  startDate?: string;
  endDate?: string;
}

export interface CrawlerRefreshParams extends CrawlerQueryParams {
  /** true 면 BPT 테이블 전체 삭제 후 저장. 기본 true. */
  replace?: boolean;
  /** ISO8601. ETA_int=0 기준점. 미지정 시 가장 빠른 ETA 자동. */
  referenceTime?: string;
}

/** term 일 때만 채워지는 date param 객체. */
function termDateParams(p: CrawlerQueryParams): Record<string, string | undefined> {
  if (p.time !== 'term') return {};
  return {
    start_date: p.startDate,
    end_date: p.endDate,
  };
}

export async function getCrawlerPreview(
  params: CrawlerQueryParams,
): Promise<CrawlerPreviewResponse> {
  const { data } = await apiClient.get<unknown>('/crawler/preview', {
    params: {
      time: params.time,
      route: params.route,
      berth: params.berth,
      skip_vsfinder: params.skipVsfinder ?? true,
      limit: params.limit ?? 200,
      ...termDateParams(params),
    },
  });
  return CrawlerPreviewResponseSchema.parse(data);
}

export async function postCrawlerRefresh(
  params: CrawlerRefreshParams,
): Promise<CrawlerRefreshResponse> {
  const { data } = await apiClient.post<unknown>('/crawler/refresh', null, {
    params: {
      time: params.time,
      route: params.route,
      berth: params.berth,
      replace: params.replace ?? true,
      reference_time: params.referenceTime,
      ...termDateParams(params),
    },
  });
  return CrawlerRefreshResponseSchema.parse(data);
}
