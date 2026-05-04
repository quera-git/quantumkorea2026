import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

import { resetMockState } from './handlers';
import { server } from './server';

// vitest-axe 의 toHaveNoViolations matcher 등록.
expect.extend(axeMatchers);

// MSW 서버를 모든 테스트 시작 전에 한 번 켠다.
// 등록되지 않은 요청은 'error' 로 처리해 누락된 mock 을 즉시 알린다.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// 각 테스트마다 핸들러 오버라이드와 in-memory state 를 초기화.
afterEach(() => {
  server.resetHandlers();
  resetMockState();
});

afterAll(() => server.close());

// jsdom 에 ResizeObserver 가 없어 react-plotly.js 등이 깨질 수 있어 polyfill.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

// jsdom 에 IntersectionObserver 도 없음. SectionNav 의 active section 추적 등에서 사용.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IOStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds: ReadonlyArray<number> = [];
  }
  globalThis.IntersectionObserver = IOStub as unknown as typeof IntersectionObserver;
}

// jsdom 에 matchMedia 가 없어 styled component 일부 코드가 깨질 수 있어 polyfill.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
