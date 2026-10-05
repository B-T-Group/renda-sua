import { Box } from '@mui/material';
import React from 'react';

/** Set table: the customer wants to eat in. */
export function EatInIllustration({ size = 96 }: { size?: number }) {
  const height = Math.round(size * 0.72);
  return (
    <Box
      component="svg"
      viewBox="0 0 120 86"
      role="img"
      aria-label="Eat in"
      sx={{ width: size, height, display: 'block', color: 'primary.main' }}
    >
      <rect x="18" y="58" width="84" height="8" rx="2" fill="currentColor" opacity={0.25} />
      <rect x="28" y="66" width="6" height="14" rx="1" fill="currentColor" />
      <rect x="86" y="66" width="6" height="14" rx="1" fill="currentColor" />
      <ellipse cx="60" cy="40" rx="22" ry="10" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M48 40c2 8 22 8 24 0" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M38 28c6-10 14-10 16 0M66 28c2-10 10-10 16 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </Box>
  );
}
