import { Box } from '@mui/material';
import React from 'react';

/** Delivery bike for bringing the order to the customer. */
export function DeliveryIllustration({ size = 96 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Delivery"
      sx={{ width: size, height: size, display: 'block' }}
    >
      <circle cx="16" cy="44" r="11" fill="none" stroke="#1F2937" strokeWidth="3.5" />
      <circle cx="16" cy="44" r="2.2" fill="#1F2937" />
      <circle cx="48" cy="44" r="11" fill="none" stroke="#1F2937" strokeWidth="3.5" />
      <circle cx="48" cy="44" r="2.2" fill="#1F2937" />
      <path
        d="M16 44 L28 26 V44 H16 M28 26 H40 L48 44"
        fill="none"
        stroke="#1D4ED8"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 22h10" stroke="#1F2937" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M40 26 L46 16" stroke="#1D4ED8" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M42 14h10" stroke="#1F2937" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="2" y="16" width="16" height="12" rx="2" fill="#0B7A3B" />
    </Box>
  );
}
