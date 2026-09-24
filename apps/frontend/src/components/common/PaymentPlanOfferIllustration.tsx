import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

/** Simple plan + targets teaching visual for payment-plan consent. */
export function PaymentPlanOfferIllustration() {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const paper = theme.palette.background.paper;
  return (
    <Box
      component="svg"
      viewBox="0 0 160 120"
      sx={{ width: 140, height: 105, mb: 1 }}
      role="img"
      aria-label="Payment plan with objectives"
    >
      <rect x="28" y="18" width="104" height="84" rx="12" fill={paper} stroke={primary} strokeWidth="3" />
      <rect x="44" y="36" width="48" height="10" rx="4" fill={primary} opacity={0.85} />
      <rect x="44" y="54" width="72" height="8" rx="4" fill={secondary} opacity={0.55} />
      <rect x="44" y="68" width="56" height="8" rx="4" fill={secondary} opacity={0.4} />
      <circle cx="118" cy="86" r="18" fill={primary} />
      <path
        d="M110 86 l5 5 11 -12"
        fill="none"
        stroke={paper}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
}
