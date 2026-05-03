import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vitest 전용 설정. vite.config.ts 와 분리해 dev 서버 옵션과 격리한다.
//   - jsdom + jest-dom matcher 자동 로드.
//   - MSW server 는 setup 에서 시작/종료한다.
//   - alias 는 vite.config.ts 와 동일하게 유지.
export default defineConfig({
  plugins: [react({ jsxImportSource: '@emotion/react' })],
  resolve: {
    // 더 구체적인 alias 가 먼저 와야 한다. `@` 가 먼저 오면 `@/shared/ui/Plot` 를
    // src/shared/ui/Plot 로 풀어버려 mock 으로 못 빠진다.
    alias: [
      {
        find: '@/shared/ui/Plot',
        replacement: path.resolve(__dirname, 'src/test/mocks/react-plotly.tsx'),
      },
      {
        find: /^react-plotly\.js(\/.*)?$/,
        replacement: path.resolve(__dirname, 'src/test/mocks/react-plotly.tsx'),
      },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // 테스트에서 axios baseURL 이 절대 URL 이 되도록 강제한다.
    // (env.backendUrl 가 빈 문자열이면 baseURL 은 '/api' 가 되고 jsdom 의 location 으로
    //  prefix 되는데, MSW handler 도 그걸 잡도록 와일드카드 패턴으로 등록한다.)
    env: {
      VITE_BACKEND_URL: 'http://test-backend',
      VITE_POLL_INTERVAL_MS: '50',
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
