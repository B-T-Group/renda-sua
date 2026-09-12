import React from 'react';
import { Box, useTheme } from '@mui/material';

interface ExportCatalogIllustrationProps {
  size?: number;
}

/** Theme-aware illustration for export catalog rails and empty states. */
export const ExportCatalogIllustration: React.FC<
  ExportCatalogIllustrationProps
> = ({ size = 96 }) => {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const paper = theme.palette.background.paper;
  const muted = theme.palette.text.secondary;

  return (
    <Box
      component="svg"
      role="img"
      aria-label="Products available for export"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      sx={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx="60" cy="60" r="54" fill={paper} stroke={primary} strokeWidth="2" />
      <rect
        x="28"
        y="48"
        width="40"
        height="28"
        rx="4"
        fill={primary}
        opacity={0.85}
      />
      <path
        d="M68 56h18l8 10v10H68V56z"
        fill={secondary}
        opacity={0.9}
      />
      <circle cx="40" cy="82" r="7" fill={muted} />
      <circle cx="86" cy="82" r="7" fill={muted} />
      <path
        d="M34 40c8-14 28-18 40-6"
        fill="none"
        stroke={primary}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M70 30l6 6-6 2"
        fill="none"
        stroke={primary}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
};

export default ExportCatalogIllustration;
