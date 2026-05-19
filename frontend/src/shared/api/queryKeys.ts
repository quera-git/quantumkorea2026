// React Query 캐시 키 단일 진입점.
// 키 충돌 방지 + invalidate 시 일관된 키 사용을 위해 객체로 모아둔다.

export const queryKeys = {
  health: ['health'] as const,
  bpt: {
    list: ['bpt', 'list'] as const,
  },
  jobs: {
    list: ['jobs', 'list'] as const,
    result: (jobId: string) => ['jobs', 'result', jobId] as const,
  },
} as const;
