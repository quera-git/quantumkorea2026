import axios, { type AxiosError } from 'axios';

import { env } from '@/shared/config/env';

// 모든 backend 호출은 반드시 이 단일 axios 인스턴스를 통해서만 수행한다 (AGENTS.md §4.2).
// 컴포넌트/페이지/훅 파일에서 직접 fetch 또는 axios 호출 금지.
//
// baseURL 결정:
//   - VITE_BACKEND_URL 이 있으면 그 절대 URL 그대로 사용 (도커 빌드 / prod).
//   - 비어 있으면 `/api` → vite dev server proxy 가 backend 로 라우팅 (dev).

const baseURL = env.backendUrl || '/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 응답 에러를 전역 콘솔에 짧게만 남긴다. 토큰/스택은 backend 에서 차단된다는 전제.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('[API ERROR]', error.response?.status ?? '-', error.message);
    return Promise.reject(error);
  },
);

/** axios 에러에서 사용자에게 보여줄 메시지를 추출. */
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (err.response?.status) return `HTTP ${err.response.status}: ${err.message}`;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
