import React from 'react';
import { useTheme } from '@mui/material';

interface AccountTypeTiersIllustrationProps {
  width?: number;
  height?: number;
}

export function AccountTypeTiersIllustration({
  width = 120,
  height = 100,
}: AccountTypeTiersIllustrationProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const grey = theme.palette.grey[300];

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Three business tiers — Standard, Premium, Elite"
      role="img"
    >
      {/* Column 1 — Standard (shortest) */}
      <rect x="8" y="64" width="28" height="28" rx="4" fill={grey} />
      {/* Column 2 — Premium (medium) */}
      <rect x="46" y="42" width="28" height="50" rx="4" fill={secondary} opacity="0.8" />
      {/* Column 3 — Elite (tallest) */}
      <rect x="84" y="14" width="28" height="78" rx="4" fill={primary} />

      {/* Stars */}
      {/* Standard: 1 star */}
      <text x="22" y="59" textAnchor="middle" fontSize="12" fill="#f59e0b">★</text>
      {/* Premium: 2 stars */}
      <text x="55" y="37" textAnchor="middle" fontSize="10" fill="#f59e0b">★★</text>
      {/* Elite: 3 stars */}
      <text x="98" y="9" textAnchor="middle" fontSize="8" fill="#f59e0b">★★★</text>

      {/* Commission labels */}
      <text x="22" y="104" textAnchor="middle" fontSize="7" fill={theme.palette.text.secondary}>12%</text>
      <text x="60" y="104" textAnchor="middle" fontSize="7" fill={theme.palette.text.secondary}>15%</text>
      <text x="98" y="104" textAnchor="middle" fontSize="7" fill={theme.palette.text.secondary}>20%</text>
    </svg>
  );
}
