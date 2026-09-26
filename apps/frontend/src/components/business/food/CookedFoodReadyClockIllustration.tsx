import { Box } from '@mui/material';
import React from 'react';

/** Simple clock metaphor for ready-in selection. */
export function CookedFoodReadyClockIllustration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 120 120"
      role="img"
      aria-label="Ready time"
      sx={{ width: 96, height: 96, mx: 'auto', display: 'block', color: 'primary.main' }}
    >
      <circle
        cx="60"
        cy="60"
        r="48"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        opacity={0.25}
      />
      <circle cx="60" cy="60" r="6" fill="currentColor" />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="28"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="60"
        y1="60"
        x2="82"
        y2="72"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity={0.85}
      />
    </Box>
  );
}
