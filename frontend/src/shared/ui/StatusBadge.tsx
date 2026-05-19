import { css, keyframes, useTheme } from '@emotion/react';

import type { AppTheme } from '@/styles/theme';
import type { JobStatus } from '@/shared/types/schema';

type Tone = 'neutral' | 'info' | 'success' | 'danger';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  50%      { box-shadow: 0 0 0 4px transparent; opacity: 0.55; }
`;

function tonePalette(theme: AppTheme, tone: Tone) {
  const map: Record<Tone, { bg: string; fg: string; dot: string }> = {
    neutral: {
      bg: theme.color.surfaceMuted,
      fg: theme.color.textMuted,
      dot: theme.color.textSubtle,
    },
    info: { bg: theme.color.infoSoft, fg: theme.color.info, dot: theme.color.info },
    success: { bg: theme.color.successSoft, fg: theme.color.success, dot: theme.color.success },
    danger: { bg: theme.color.dangerSoft, fg: theme.color.danger, dot: theme.color.danger },
  };
  return map[tone];
}

const STATUS_TO_TONE: Record<JobStatus, Tone> = {
  pending: 'neutral',
  running: 'info',
  succeeded: 'success',
  failed: 'danger',
};

const STATUS_TO_LABEL: Record<JobStatus, string> = {
  pending: '대기',
  running: '실행 중',
  succeeded: '완료',
  failed: '실패',
};

interface Props {
  status: JobStatus;
}

export function StatusBadge({ status }: Props) {
  const theme = useTheme();
  const tone = STATUS_TO_TONE[status];
  const animated = status === 'running' || status === 'pending';
  const palette = tonePalette(theme, tone);

  return (
    <span
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${theme.spacing(1)};
        padding: 2px 8px;
        font-size: ${theme.font.size.xs};
        font-weight: ${theme.font.weight.medium};
        border-radius: ${theme.radius.pill};
        background: ${palette.bg};
        color: ${palette.fg};
        line-height: 1.4;
        letter-spacing: ${theme.font.letter.tight};
      `}
    >
      <span
        aria-hidden="true"
        css={css`
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${palette.dot};
          color: ${palette.dot};
          flex-shrink: 0;
          animation: ${animated
            ? css`${pulse} 1.6s ${theme.motion.easing.standard} infinite`
            : 'none'};
        `}
      />
      {STATUS_TO_LABEL[status]}
    </span>
  );
}
