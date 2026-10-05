import { Box } from '@mui/material';
import React from 'react';

/** Set table: plate of food on a wooden table. */
export function EatInIllustration({ size = 96 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Eat in"
      sx={{ width: size, height: size, display: 'block' }}
    >
      <ellipse cx="32" cy="26" rx="20" ry="11" fill="#FFF8F1" stroke="#E4D3C0" strokeWidth="2" />
      <ellipse cx="32" cy="24" rx="11" ry="6" fill="#F4A261" />
      <circle cx="23" cy="22" r="4" fill="#2A9D8F" />
      <circle cx="41" cy="21" r="3.5" fill="#E76F51" />
      <circle cx="32" cy="20" r="2.2" fill="#E9C46A" />
      <rect x="2" y="36" width="60" height="10" rx="2" fill="#E7C08A" />
      <rect x="2" y="44" width="60" height="4" fill="#B8884E" />
      <rect x="8" y="48" width="6" height="12" rx="2" fill="#8D5A2B" />
      <rect x="50" y="48" width="6" height="12" rx="2" fill="#8D5A2B" />
    </Box>
  );
}
