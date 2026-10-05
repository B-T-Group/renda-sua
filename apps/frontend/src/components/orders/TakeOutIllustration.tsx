import { Box } from '@mui/material';
import React from 'react';

/** Takeout bag the customer collects. */
export function TakeOutIllustration({ size = 96 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Take out"
      sx={{ width: size, height: size, display: 'block' }}
    >
      <path
        d="M12 20h40l-4 38H16L12 20z"
        fill="#F6D7A8"
        stroke="#C9956A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 20c0-8 4-12 8-12s8 4 8 12"
        fill="none"
        stroke="#8D5A2B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="16" y="34" width="32" height="8" fill="#0B7A3B" />
      <circle cx="32" cy="38" r="2" fill="#F6D7A8" />
    </Box>
  );
}
