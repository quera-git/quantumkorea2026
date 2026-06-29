// 환경변수 단일 진입점. import.meta.env 직접 접근은 여기서만.

const POLL_DEFAULT_MS = 5000;

function parseInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  /** axios baseURL. 비어 있으면 vite proxy 의 `/api` 가 활용된다. */
  backendUrl: import.meta.env.VITE_BACKEND_URL?.trim() ?? '',
  /** GET /results 폴링 간격(ms). */
  pollIntervalMs: parseInt(import.meta.env.VITE_POLL_INTERVAL_MS, POLL_DEFAULT_MS),
  /**
   * 부스 데모 모드. true 면 backend 의존 UI (라이브 BPTC, BPT 직접 워크플로) 를 숨김.
   * Vercel frontend-only 배포 시 VITE_DEMO_MODE=1 로 설정.
   */
  demoMode: import.meta.env.VITE_DEMO_MODE === '1',
} as const;
