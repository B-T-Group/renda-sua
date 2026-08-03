import { Box, useTheme } from '@mui/material';
import React from 'react';

/** Open storefront with checkmark — store is live. */
export function GoLiveCelebrationIllustration({
  size = 120,
  label,
}: {
  size?: number;
  label: string;
}) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const success = theme.palette.success.main;
  const paper = theme.palette.background.paper;

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={label}
      sx={{ display: 'block', mx: 'auto' }}
    >
      <circle cx="60" cy="60" r="54" fill={success} opacity={0.1} />
      <rect x="28" y="42" width="44" height="40" rx="4" fill={primary} opacity={0.9} />
      <path d="M28 48 L50 34 L72 48" fill={primary} />
      <rect x="40" y="58" width="12" height="16" rx="1" fill={paper} />
      <circle cx="86" cy="72" r="18" fill={success} />
      <path
        d="M78 72 L84 78 L96 64"
        stroke={paper}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Box>
  );
}
