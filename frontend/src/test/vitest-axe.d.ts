// vitest-axe 의 toHaveNoViolations matcher 를 vitest 의 Assertion 인터페이스에 합치기.
// AxeMatchers 는 non-generic 이므로 그대로 extends.

import type { AxeMatchers } from 'vitest-axe/matchers';
import 'vitest';

declare module 'vitest' {
  /* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
  // @ts-expect-error -- vitest 의 Assertion 은 generic 이지만 AxeMatchers 는 non-generic. 의도적 병합.
  interface Assertion<T> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
}
