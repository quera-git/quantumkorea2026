// ColorMode (light/dark) provider + toggle hook.
//   - localStorage 에 사용자 선택 보관 (key: 'color-mode')
//   - 첫 진입은 prefers-color-scheme 기반 자동
//   - 시스템 설정 변경 시에도 (사용자가 명시적 선택 안 했을 때) 자동 추종
//   - <html data-color-mode="dark"> 마킹해서 CSS 에서 :root[data-color-mode='dark'] 셀렉터 활용 가능

import { ThemeProvider } from '@emotion/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { themeForMode, type ColorMode } from '@/styles/themes';

const STORAGE_KEY = 'color-mode';

interface ColorModeContextValue {
  mode: ColorMode;
  /** 사용자가 명시적으로 선택했는지. false 면 시스템 추종. */
  explicit: boolean;
  set: (mode: ColorMode) => void;
  toggle: () => void;
  /** localStorage 비우고 시스템 추종으로 복귀. */
  followSystem: () => void;
}

const ColorModeCtx = createContext<ColorModeContextValue | null>(null);

function readStored(): ColorMode | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

function detectSystem(): ColorMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState<boolean>(() => readStored() !== null);
  const [mode, setMode] = useState<ColorMode>(() => readStored() ?? detectSystem());

  // <html data-color-mode> 동기화 + body 배경 즉시 반영.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-color-mode', mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  // 시스템 prefers-color-scheme 변경 시 (explicit=false 일 때만) 자동 추종.
  useEffect(() => {
    if (explicit) return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setMode(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [explicit]);

  const set = useCallback((next: ColorMode) => {
    setMode(next);
    setExplicit(true);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    set(mode === 'dark' ? 'light' : 'dark');
  }, [mode, set]);

  const followSystem = useCallback(() => {
    setExplicit(false);
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    setMode(detectSystem());
  }, []);

  const theme = useMemo(() => themeForMode(mode), [mode]);
  const ctx = useMemo<ColorModeContextValue>(
    () => ({ mode, explicit, set, toggle, followSystem }),
    [mode, explicit, set, toggle, followSystem],
  );

  return (
    <ColorModeCtx.Provider value={ctx}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeCtx.Provider>
  );
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeCtx);
  if (!ctx) {
    throw new Error('useColorMode 는 ColorModeProvider 내부에서만 사용 가능.');
  }
  return ctx;
}
