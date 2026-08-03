import { Box } from '@mui/material';
import { keyframes, useTheme } from '@mui/material/styles';
import React from 'react';

const floatY = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

/** Storefront + map pin — first business location metaphor */
export const StorefrontPinIllustration: React.FC = () => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  return (
    <Box
      component="svg"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Store location"
      sx={{
        width: '100%',
        maxWidth: 160,
        height: 'auto',
        display: 'block',
        animation: `${floatY} 3.4s ease-in-out infinite`,
      }}
    >
      <ellipse cx="80" cy="108" rx="48" ry="6" fill={accent} opacity={0.12} />
      <path
        d="M36 70h88v30H36z"
        stroke={accent}
        strokeWidth={2.5}
        fill={`${accent}14`}
      />
      <path
        d="M30 70l20-22h60l20 22"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill={`${accent}1a`}
      />
      <rect x="68" y="78" width="24" height="22" rx="2" fill={accent} opacity={0.35} />
      <rect x="44" y="78" width="16" height="14" rx="2" fill={accent} opacity={0.22} />
      <rect x="100" y="78" width="16" height="14" rx="2" fill={accent} opacity={0.22} />
      <path
        d="M118 48c0-10 8-18 18-18s18 8 18 18c0 14-18 28-18 28S118 62 118 48z"
        stroke={accent}
        strokeWidth={2.5}
        fill={`${accent}22`}
      />
      <circle cx="136" cy="48" r="6" fill={accent} opacity={0.55} />
    </Box>
  );
};
