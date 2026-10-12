import { Box, useTheme } from '@mui/material';
import React from 'react';

/** Document and pen — the agent agreement to sign. */
export function AgentAgreementIllustration({
  size = 96,
  label,
}: {
  size?: number;
  label: string;
}) {
  const theme = useTheme();
  const ink = theme.palette.primary.main;
  const paper = theme.palette.background.paper;
  const line = theme.palette.text.secondary;

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={label}
    >
      <rect x="22" y="14" width="44" height="58" rx="6" fill={paper} stroke={ink} strokeWidth="2" />
      <path d="M32 30h24M32 40h24M32 50h16" stroke={line} strokeWidth="2" strokeLinecap="round" />
      <path d="M58 52l16 16-8 2-10-18z" fill={ink} />
    </Box>
  );
}
