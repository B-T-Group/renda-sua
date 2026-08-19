import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

/** Store + coin: Saturday referral commission. */
export const ReferralSaturdayPayoutIllustration: React.FC<{ size?: number }> = ({
  size = 72,
}) => {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const success = theme.palette.success.main;
  const paper = theme.palette.background.paper;

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 140 140"
      role="img"
      aria-label="Saturday referral payout"
      sx={{ flexShrink: 0 }}
    >
      <circle cx="70" cy="70" r="64" fill={primary} opacity={0.08} />
      <rect x="28" y="48" width="52" height="44" rx="8" fill={primary} />
      <path d="M28 60 H80" stroke={paper} strokeWidth={2} opacity={0.35} />
      <rect x="36" y="68" width="20" height="16" rx="3" fill={paper} opacity={0.9} />
      <path
        d="M80 70 H96"
        stroke={success}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d="M90 64 L98 70 L90 76"
        stroke={success}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="112" cy="70" r="18" fill={success} />
      <path
        d="M112 60 V80 M104 68 H120"
        stroke={paper}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Box>
  );
};
