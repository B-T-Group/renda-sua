import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

const SIZE = 72;
const RADIUS = 28;

/** How far an agent is through the objectives on one payment plan. */
export function ObjectiveProgressRing({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const theme = useTheme();
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const circumference = 2 * Math.PI * RADIUS;
  const filled = (clamped / 100) * circumference;
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      sx={{ width: SIZE, height: SIZE, flexShrink: 0 }}
      role="img"
      aria-label={label}
    >
      <circle
        cx="36"
        cy="36"
        r={RADIUS}
        fill="none"
        stroke={theme.palette.action.hover}
        strokeWidth="6"
      />
      <circle
        cx="36"
        cy="36"
        r={RADIUS}
        fill="none"
        stroke={theme.palette.primary.main}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 36 36)"
      />
      <text
        x="36"
        y="40"
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        fill={theme.palette.text.primary}
      >
        {clamped}%
      </text>
    </Box>
  );
}
