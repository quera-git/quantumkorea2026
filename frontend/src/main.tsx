import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { AppProviders } from './app/providers';

// Pretendard 는 index.html 의 CDN 링크로 로드한다 (한글 글리프 포함, npm 패키지엔 latin 만 있어 한글 누락).

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root 엘리먼트를 찾지 못했습니다.');
}

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
