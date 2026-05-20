import { Global, css, useTheme } from '@emotion/react';
import { Reset } from 'styled-reset';

// styled-reset + 우리 base style + 반응형/접근성/모션 기본값.
// useTheme 가 ColorMode 따라 light/dark 자동 전환.
export function GlobalStyle() {
  const t = useTheme();

  return (
    <>
      <Reset />
      <Global
        styles={css`
          *,
          *::before,
          *::after {
            box-sizing: border-box;
          }

          html {
            color-scheme: ${t.mode};
          }

          html,
          body,
          #root {
            height: 100%;
          }

          body {
            margin: 0;
            background: ${t.color.bg};
            color: ${t.color.text};
            font-family: ${t.font.family};
            font-size: ${t.font.size.base};
            line-height: ${t.font.lineHeight.normal};
            letter-spacing: ${t.font.letter.normal};
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            transition: background-color ${t.motion.duration.base}
              ${t.motion.easing.standard},
              color ${t.motion.duration.base} ${t.motion.easing.standard};
          }

          /* 헤딩 — 약간 좁은 letter-spacing */
          h1,
          h2,
          h3,
          h4 {
            letter-spacing: ${t.font.letter.tight};
            line-height: ${t.font.lineHeight.tight};
          }

          button {
            font-family: inherit;
            cursor: pointer;
            color: inherit;
          }
          button:disabled {
            cursor: not-allowed;
          }
          button:focus-visible,
          a:focus-visible,
          [role='button']:focus-visible,
          input:focus-visible,
          select:focus-visible,
          textarea:focus-visible {
            outline: none;
            box-shadow: ${t.shadow.focus};
          }

          input,
          select,
          textarea {
            font-family: inherit;
            font-size: inherit;
            color: inherit;
          }

          a {
            color: ${t.color.primary};
            text-decoration: none;
            transition: color ${t.motion.duration.fast} ${t.motion.easing.standard};
          }
          a:hover {
            color: ${t.color.primaryHover};
          }

          code {
            font-family: ${t.font.mono};
            font-size: 0.9em;
            background: ${t.color.surfaceAlt};
            color: ${t.color.text};
            padding: 1px 4px;
            border-radius: ${t.radius.sm};
            font-variant-numeric: tabular-nums;
          }

          kbd {
            font-family: ${t.font.mono};
            font-size: 0.85em;
            background: ${t.color.surfaceMuted};
            border: 1px solid ${t.color.border};
            border-bottom-width: 2px;
            padding: 1px 5px;
            border-radius: ${t.radius.sm};
            color: ${t.color.text};
          }

          /* 모든 숫자 컬럼/모노 폰트는 등폭 숫자 */
          [class*='mono'],
          code,
          kbd,
          pre {
            font-variant-numeric: tabular-nums;
          }

          /* 스크롤바 — dark 모드 대응 */
          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          ::-webkit-scrollbar-track {
            background: ${t.color.surfaceAlt};
          }
          ::-webkit-scrollbar-thumb {
            background: ${t.color.borderStrong};
            border-radius: ${t.radius.pill};
            border: 2px solid ${t.color.surfaceAlt};
          }
          ::-webkit-scrollbar-thumb:hover {
            background: ${t.color.textSubtle};
          }

          /* 선택 색 */
          ::selection {
            background: ${t.color.primarySoft};
            color: ${t.color.primary};
          }

          /* skip-to-content link — Tab 누르면 첫 번째로 등장 */
          .skip-to-content {
            position: absolute;
            top: -100px;
            left: 8px;
            padding: 8px 16px;
            background: ${t.color.primary};
            color: ${t.color.textInverse};
            border-radius: ${t.radius.md};
            font-size: ${t.font.size.sm};
            font-weight: ${t.font.weight.semibold};
            z-index: ${t.z.toast};
            transition: top ${t.motion.duration.base} ${t.motion.easing.enter};
          }
          .skip-to-content:focus {
            top: 8px;
          }

          /* reduced-motion 사용자 — 모든 transition/animation 비활성화 */
          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation-duration: 0.001ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.001ms !important;
              scroll-behavior: auto !important;
            }
          }
        `}
      />
    </>
  );
}
