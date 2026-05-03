import styled from '@emotion/styled';

interface StackProps {
  /** spacing 토큰 곱(=4px). 기본 3 = 12px. */
  gap?: number;
  /** 가로/세로. 기본 column. */
  direction?: 'row' | 'column';
  /** flex align-items. */
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  /** flex justify-content. */
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  /** wrap 허용. 기본 nowrap. */
  wrap?: boolean;
}

// styled prop 들이 DOM 으로 forward 되어 React unknown-attribute 경고가 나지 않도록
// 명시적으로 차단한다 (특히 `wrap` 은 div 의 invalid boolean attr).
const STACK_PROPS = new Set(['gap', 'direction', 'align', 'justify', 'wrap']);

export const Stack = styled('div', {
  shouldForwardProp: (prop) => !STACK_PROPS.has(prop),
})<StackProps>(({ theme, gap = 3, direction = 'column', align, justify, wrap }) => ({
  display: 'flex',
  flexDirection: direction,
  gap: theme.spacing(gap),
  alignItems: align,
  justifyContent: justify,
  flexWrap: wrap ? 'wrap' : 'nowrap',
}));
