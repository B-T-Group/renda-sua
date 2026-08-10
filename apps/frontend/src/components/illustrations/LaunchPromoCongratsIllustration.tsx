import { Box, useTheme } from '@mui/material';
import React from 'react';

/** Gift / zero-commission celebration for launch promo winners. */
export function LaunchPromoCongratsIllustration({
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
  const warning = theme.palette.warning.main;

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
      <circle cx="60" cy="60" r="54" fill={success} opacity={0.12} />
      <rect x="34" y="52" width="52" height="36" rx="6" fill={primary} />
      <rect x="34" y="44" width="52" height="14" rx="4" fill={warning} />
      <rect x="54" y="44" width="12" height="44" fill={paper} opacity={0.9} />
      <text
        x="60"
        y="78"
        textAnchor="middle"
        fill={paper}
        fontSize="14"
        fontWeight="700"
      >
        0%
      </text>
    </Box>
  );
}
