/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 백엔드 절대 URL.
   * - 비어 있으면 axios baseURL 은 빈 문자열 → vite dev proxy `/api → :8000` 사용.
   * - 도커 빌드에서는 build args 로 `http://localhost:8000` 가 주입된다.
   */
  readonly VITE_BACKEND_URL?: string;

  /** 결과 폴링 간격(ms). 기본 5000. */
  readonly VITE_POLL_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
