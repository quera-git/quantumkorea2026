// Backwards-compat shim. 기존 import 들이 '@/styles/theme' 의 `theme` / `AppTheme` 를 쓰고
// 있어 그대로 두기 위해 default = light theme 을 re-export. 새 코드는 themes.ts 의
// lightTheme / darkTheme / themeForMode 를 직접 사용 권장.

export { lightTheme as theme, lightTheme, darkTheme, themeForMode } from './themes';
export type { AppTheme, ColorMode } from './themes';
