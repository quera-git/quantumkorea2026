import { Global, css, useTheme } from '@emotion/react';
import { Reset } from 'styled-reset';

// styled-reset + 우리 base style.
// font-family/색/박스사이징 같은 기본값을 한 곳에 모아둔다.
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
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          button {
            font-family: inherit;
            cursor: pointer;
          }

          button:disabled {
            cursor: not-allowed;
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
          }

          code {
            font-family: ${t.font.mono};
            font-size: 0.9em;
            background: ${t.color.surfaceAlt};
            padding: 1px 4px;
            border-radius: ${t.radius.sm};
          }
        `}
      />
    </>
  );
}
