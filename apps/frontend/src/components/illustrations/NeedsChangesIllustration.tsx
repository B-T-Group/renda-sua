import { Box, useTheme } from '@mui/material';
import type { RejectionCategory } from '../../types/itemRejectionRecovery';
import { isNotAllowedCategory } from '../../utils/itemRejectionRecovery';

type Props = {
  category?: RejectionCategory | null;
  size?: number;
};

/** Amber checklist for recoverable rejections; red shield for not-allowed items. */
export function NeedsChangesIllustration({ category, size = 72 }: Props) {
  const theme = useTheme();
  const blocked = isNotAllowedCategory(category);
  const accent = blocked ? theme.palette.error.main : theme.palette.warning.main;
  const paper = theme.palette.background.paper;
  const label = blocked
    ? 'This item is not allowed'
    : 'This item needs changes';

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 72 72"
      role="img"
      aria-label={label}
      sx={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx="36" cy="36" r="32" fill={accent} opacity={0.12} />
      <rect
        x="18"
        y="16"
        width="36"
        height="42"
        rx="6"
        fill={paper}
        stroke={accent}
        strokeWidth={2.5}
      />
      {blocked ? (
        <path
          d="M28 36 L44 36 M36 28 L36 44"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          transform="rotate(45 36 36)"
        />
      ) : (
        <path
          d="M26 34 L33 41 L48 26"
          fill="none"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Box>
  );
}
