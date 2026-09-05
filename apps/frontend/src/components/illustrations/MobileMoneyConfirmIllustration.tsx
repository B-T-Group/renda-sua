import { Box, useTheme } from '@mui/material';
import React from 'react';

type Props = {
  size?: number;
  label?: string;
};

/** Phone with coin — Mobile Money approve-on-phone waiting visual. */
export function MobileMoneyConfirmIllustration({
  size = 140,
  label = 'Approve mobile money on your phone',
}: Props) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const success = theme.palette.success.main;
  const paper = theme.palette.background.paper;
  const secondaryText = theme.palette.text.secondary;

  return (
    <Box
      component="svg"
      width={size}
      height={(size * 120) / 140}
      viewBox="0 0 140 120"
      role="img"
      aria-label={label}
      sx={{ display: 'block', mx: 'auto' }}
    >
      <rect
        x="42"
        y="12"
        width="44"
        height="78"
        rx="8"
        fill={primary}
        opacity={0.45}
      />
      <rect x="48" y="24" width="32" height="48" rx="4" fill={paper} opacity={0.9} />
      <circle cx="64" cy="82" r="3.5" fill={primary} opacity={0.7} />
      <circle cx="98" cy="58" r="22" fill={success} opacity={0.22} />
      <circle cx="98" cy="58" r="16" fill={success} opacity={0.55} />
      <path
        d="M92 58h12M98 52v12"
        stroke={paper}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M36 100c14-10 54-10 68 0"
        stroke={secondaryText}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        opacity={0.3}
      />
    </Box>
  );
}
