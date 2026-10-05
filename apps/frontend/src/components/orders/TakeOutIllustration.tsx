import { Box } from '@mui/material';
import React from 'react';

/** Takeout bag: the customer will collect the order. */
export function TakeOutIllustration({
  size = 96,
  color = 'primary.main',
}: {
  size?: number;
  color?: string;
}) {
  const height = Math.round(size * 0.72);
  return (
    <Box
      component="svg"
      viewBox="0 0 120 86"
      role="img"
      aria-label="Take out"
      sx={{ width: size, height, display: 'block', color }}
    >
      <path
        d="M34 34h52l-4 40H38L34 34z"
        fill="currentColor"
        opacity={0.15}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M46 34c0-10 6-16 14-16s14 6 14 16" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M52 48h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </Box>
  );
}
