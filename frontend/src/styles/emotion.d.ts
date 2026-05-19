// Emotion 의 기본 Theme 타입을 우리 AppTheme 으로 확장.
// 이렇게 해두면 styled / css prop 안에서 theme 자동완성이 동작한다.

import '@emotion/react';
import type { AppTheme } from './theme';

declare module '@emotion/react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface Theme extends AppTheme {}
}
