import { Box, useTheme } from '@mui/material';
import React from 'react';

type Props = {
  size?: number;
  label?: string;
};

/** Storefront + pin — store reach teaching visual. */
export function StorefrontReachIllustration({
  size = 96,
  label = 'Store reach',
}: Props) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
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
      <circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
      <rect
        x="30"
        y="48"
        width="60"
        height="42"
        rx="6"
        fill={paper}
        stroke={primary}
        strokeWidth={2}
      />
      <path d="M26 48 L60 28 L94 48" fill={primary} opacity={0.9} />
      <rect x="52" y="62" width="16" height="28" rx="2" fill={secondary} opacity={0.85} />
      <rect x="36" y="58" width="12" height="12" rx="2" fill={primary} opacity={0.25} />
      <rect x="72" y="58" width="12" height="12" rx="2" fill={primary} opacity={0.25} />
      <path
        d="M88 34 C80 34 74 40 74 47 C74 56 88 68 88 68 C88 68 102 56 102 47 C102 40 96 34 88 34 Z"
        fill={secondary}
      />
      <circle cx="88" cy="47" r="5" fill={paper} />
    </Box>
  );
}

/** Empty catalog: storefront + magnifying glass. */
export function CatalogEmptyIllustration({
  size = 112,
  label = 'Empty catalog',
}: Props) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const info = theme.palette.info.main;
  const warning = theme.palette.warning.main;
  const secondaryText = theme.palette.text.secondary;

  return (
    <Box
      component="svg"
      width={size}
      height={Math.round(size * 0.8)}
      viewBox="0 0 140 112"
      role="img"
      aria-label={label}
      sx={{ display: 'block', mx: 'auto' }}
    >
      <rect x="20" y="32" width="56" height="56" rx="10" fill={primary} opacity={0.35} />
      <rect x="28" y="44" width="40" height="8" rx="2" fill={primary} opacity={0.65} />
      <rect x="28" y="58" width="28" height="6" rx={2} fill={secondaryText} opacity={0.3} />
      <circle cx="96" cy="52" r="22" fill="none" stroke={info} strokeWidth={3} opacity={0.8} />
      <path
        d="M112 68l14 14"
        stroke={info}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M48 88c8-6 18-6 26 0"
        stroke={warning}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        opacity={0.6}
      />
    </Box>
  );
}
