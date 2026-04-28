import axios from 'axios';

// 모든 backend 호출은 반드시 이 단일 axios 인스턴스를 통해서만 수행한다 (AGENTS.md §4.2).
// 컴포넌트/페이지에서 직접 fetch 또는 axios 호출 금지.

const baseURL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 토큰/민감정보가 응답 헤더/본문에 들어오지 않도록 backend가 차단한다는 전제 하에
    // 단순 로그만 남긴다.
    // eslint-disable-next-line no-console
    console.error('[API ERROR]', error?.response?.status, error?.message);
    return Promise.reject(error);
  },
);
