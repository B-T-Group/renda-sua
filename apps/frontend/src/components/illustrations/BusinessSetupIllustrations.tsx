import { Box, useTheme } from '@mui/material';
import React from 'react';

type IllustrationProps = {
  size?: number;
  label: string;
};

function SetupIllustrationShell({
  size = 96,
  label,
  children,
}: IllustrationProps & { children: React.ReactNode }) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={label}
      sx={{ display: 'block' }}
    >
      <circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
      {children}
    </Box>
  );
}

/** Contract / agreement document metaphor. */
export function SetupAgreementIllustration({ size = 96, label }: IllustrationProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const paper = theme.palette.background.paper;

  return (
    <SetupIllustrationShell size={size} label={label}>
      <rect x="34" y="28" width="52" height="64" rx="4" fill={primary} opacity={0.9} />
      <rect x="42" y="40" width="36" height="4" rx="2" fill={paper} />
      <rect x="42" y="50" width="28" height="4" rx="2" fill={paper} opacity={0.8} />
      <rect x="42" y="60" width="32" height="4" rx="2" fill={paper} opacity={0.7} />
      <path
        d="M48 78 L56 86 L74 68"
        stroke={paper}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SetupIllustrationShell>
  );
}

/** Payout / card metaphor for Stripe Connect. */
export function SetupPayoutsIllustration({ size = 96, label }: IllustrationProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const paper = theme.palette.background.paper;

  return (
    <SetupIllustrationShell size={size} label={label}>
      <rect x="28" y="40" width="64" height="40" rx="6" fill={primary} opacity={0.9} />
      <rect x="28" y="48" width="64" height="10" fill={secondary} opacity={0.85} />
      <rect x="36" y="66" width="22" height="6" rx="2" fill={paper} />
      <circle cx="78" cy="69" r="5" fill={paper} opacity={0.9} />
    </SetupIllustrationShell>
  );
}

/** ID card metaphor for KYC upload. */
export function SetupIdentityIllustration({ size = 96, label }: IllustrationProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const paper = theme.palette.background.paper;

  return (
    <SetupIllustrationShell size={size} label={label}>
      <rect x="26" y="38" width="68" height="44" rx="6" fill={primary} opacity={0.9} />
      <circle cx="46" cy="58" r="10" fill={paper} opacity={0.95} />
      <rect x="62" y="50" width="24" height="5" rx="2" fill={paper} />
      <rect x="62" y="60" width="18" height="5" rx="2" fill={paper} opacity={0.75} />
    </SetupIllustrationShell>
  );
}

/** Phone / mobile money metaphor. */
export function SetupMobileMoneyIllustration({ size = 96, label }: IllustrationProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const paper = theme.palette.background.paper;
  const secondary = theme.palette.secondary.main;

  return (
    <SetupIllustrationShell size={size} label={label}>
      <rect x="44" y="26" width="32" height="68" rx="6" fill={primary} opacity={0.9} />
      <rect x="48" y="36" width="24" height="40" rx="2" fill={paper} />
      <circle cx="60" cy="84" r="3" fill={paper} />
      <circle cx="78" cy="48" r="10" fill={secondary} opacity={0.95} />
      <rect x="75" y="42" width="6" height="12" rx="1" fill={paper} />
      <rect x="72" y="45" width="12" height="6" rx="1" fill={paper} />
    </SetupIllustrationShell>
  );
}

/** Product / catalog metaphor. */
export function SetupCatalogIllustration({ size = 96, label }: IllustrationProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const paper = theme.palette.background.paper;

  return (
    <SetupIllustrationShell size={size} label={label}>
      <rect x="30" y="42" width="36" height="36" rx="4" fill={primary} opacity={0.9} />
      <rect x="38" y="50" width="20" height="14" rx="2" fill={paper} opacity={0.85} />
      <circle cx="78" cy="52" r="16" fill={secondary} opacity={0.95} />
      <path
        d="M78 44 V60 M70 52 H86"
        stroke={paper}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </SetupIllustrationShell>
  );
}
