import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite 설정.
//   - @/* alias → src/*
//   - dev 모드에서 VITE_BACKEND_URL 이 비어 있을 때만 /api → backend 로 프록시.
//     (도커 빌드 시에는 VITE_BACKEND_URL=http://localhost:8000 이 빌드 인자로
//      들어와 axios 가 절대 URL 로 직접 호출하므로 프록시 불필요.)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backendUrl = env.VITE_BACKEND_URL?.trim();

  return {
    plugins: [react({ jsxImportSource: '@emotion/react' })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: backendUrl
        ? undefined
        : {
            '/api': {
              target: 'http://localhost:8000',
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/api/, ''),
            },
          },
    },
  };
});
