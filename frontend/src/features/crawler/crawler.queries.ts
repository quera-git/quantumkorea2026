// crawler 호출 React Query hook.
// 두 동작:
//   1) preview — 풍부 시나리오 변환에 사용. 사용자 명시 trigger.
//   2) refresh — BPT 테이블 영속화 (백엔드가 처리). BPT 패널 자동 갱신.
//
// 라이브 시나리오 확보는 preview 응답을 변환한 결과를 liveScenarioStore 에 저장하는 형태.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/api/queryKeys';
import {
  getCrawlerPreview,
  postCrawlerRefresh,
  type CrawlerQueryParams,
  type CrawlerRefreshParams,
} from '@/shared/api/crawler.api';

import { convertCrawledRows } from './liveConverter';
import { useLiveScenarioStore, type LiveScenarioSlice } from './liveScenarioStore';

/**
 * preview 응답을 받아 풍부 Assignment 로 변환 + liveScenarioStore 갱신.
 * BPT 테이블에 저장하진 않음 (refresh 와 별개).
 */
export function useCrawlerPreviewAndStore() {
  const setLive = useLiveScenarioStore((s) => s.setLive);

  return useMutation({
    mutationFn: async (params: CrawlerQueryParams) => {
      const response = await getCrawlerPreview({ ...params, limit: 500 });
      const { assignments, dropped } = convertCrawledRows(response.rows);
      const stamp = new Date();
      const label = `라이브 (${stamp.getHours().toString().padStart(2, '0')}:${stamp
        .getMinutes()
        .toString()
        .padStart(2, '0')})`;
      const slice: LiveScenarioSlice = {
        id: `live-${stamp.getTime()}`,
        label,
        rows: assignments,
        params: { time: params.time, route: params.route, berth: params.berth },
        fetchedAt: stamp.toISOString(),
        meta: {
          crawled: response.count,
          saved: 0, // preview 는 저장 X
          skipped: 0,
          droppedInConversion: dropped,
        },
      };
      setLive(slice);
      return slice;
    },
  });
}

/**
 * refresh — 백엔드가 크롤링 + BPT 테이블 저장. 응답으로 통계만.
 * BPT 패널이 invalidate 되어 자동 갱신.
 */
export function useCrawlerRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CrawlerRefreshParams) => postCrawlerRefresh(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bpt.list }),
  });
}
