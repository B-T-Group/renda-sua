import { Box } from '@mui/material';
import React from 'react';
import { useTheme } from '@mui/material/styles';

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Box component="svg" width="96" height="72" viewBox="0 0 96 72" role="img" aria-label={label}>
      {children}
    </Box>
  );
}

export function ScheduleArt({ label }: { label: string }) {
  const theme = useTheme();
  const ink = theme.palette.primary.main;
  const paper = theme.palette.background.paper;
  return (
    <Frame label={label}>
      <rect x="8" y="10" width="80" height="52" rx="8" fill={ink} />
      <rect x="16" y="18" width="64" height="10" rx="3" fill={paper} />
      <rect x="16" y="34" width="28" height="8" rx="3" fill={theme.palette.warning.main} />
      <rect x="48" y="34" width="32" height="8" rx="3" fill={paper} opacity="0.7" />
    </Frame>
  );
}

export function AdvanceArt({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Frame label={label}>
      <rect x="14" y="16" width="68" height="42" rx="8" fill={theme.palette.secondary.main} />
      <circle cx="48" cy="37" r="12" fill={theme.palette.background.paper} />
      <path d="M48 30v14M41 37h14" stroke={theme.palette.secondary.dark} strokeWidth="3" />
    </Frame>
  );
}

export function CreditArt({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Frame label={label}>
      <rect x="18" y="14" width="60" height="40" rx="8" fill={theme.palette.info.main} />
      <rect x="26" y="24" width="28" height="6" rx="3" fill={theme.palette.background.paper} />
      <rect x="26" y="36" width="44" height="8" rx="3" fill={theme.palette.warning.light} />
    </Frame>
  );
}

export function AssignmentArt({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Frame label={label}>
      <circle cx="28" cy="28" r="12" fill={theme.palette.primary.main} />
      <rect x="46" y="18" width="36" height="36" rx="8" fill={theme.palette.secondary.main} />
      <path d="M40 36h8" stroke={theme.palette.text.primary} strokeWidth="3" />
    </Frame>
  );
}
