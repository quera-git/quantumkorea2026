import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';

// 부드러운 좌→우 shimmer.
const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

interface SkeletonProps {
  /** px 또는 css 길이. 기본 100%. */
  width?: number | string;
  /** px 또는 css 길이. 기본 14px. */
  height?: number | string;
  /** 둥근 정도. 기본 sm. pill 도 가능. */
  radius?: 'sm' | 'md' | 'lg' | 'pill';
  /** display 가 inline-block 일지 block 일지. 기본 block. */
  inline?: boolean;
}

export const Skeleton = styled('span', {
  shouldForwardProp: (p) => !['width', 'height', 'radius', 'inline'].includes(p),
})<SkeletonProps>(({ theme, width = '100%', height = 14, radius = 'sm', inline }) => ({
  display: inline ? 'inline-block' : 'block',
  width: typeof width === 'number' ? `${width}px` : width,
  height: typeof height === 'number' ? `${height}px` : height,
  borderRadius: theme.radius[radius],
  background: `linear-gradient(90deg, ${theme.color.surfaceAlt} 0%, ${theme.color.surfaceMuted} 50%, ${theme.color.surfaceAlt} 100%)`,
  backgroundSize: '200% 100%',
  animation: `${shimmer} 1.4s ${theme.motion.easing.standard} infinite`,
}));

export const SkeletonStack = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));
