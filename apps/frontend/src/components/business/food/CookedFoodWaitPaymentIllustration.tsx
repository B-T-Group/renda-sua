import { Box } from '@mui/material';
import React from 'react';

/** Phone request, then a paused pot — cook only after payment. */
export function CookedFoodWaitPaymentIllustration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 160 96"
      role="img"
      aria-label="Wait for payment"
      sx={{ width: 160, height: 96, mx: 'auto', display: 'block', color: 'warning.main' }}
    >
      <rect x="18" y="8" width="44" height="80" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="40" cy="76" r="3" fill="currentColor" />
      <path d="M32 28h16M32 38h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="112" cy="48" r="28" fill="none" stroke="currentColor" strokeWidth="3" opacity={0.35} />
      <path
        d="M100 48h8l4-10 6 20 4-10h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
}
