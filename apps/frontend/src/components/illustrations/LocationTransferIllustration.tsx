import { Box, useTheme } from '@mui/material';

/** Storefront moving from one business to another. */
export function LocationTransferIllustration({ size = 120 }: { size?: number }) {
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
      aria-label="Transfer a location to another business"
      sx={{ display: 'block', mx: 'auto' }}
    >
      <circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
      <rect x="18" y="48" width="28" height="28" rx="4" fill={primary} opacity={0.9} />
      <path d="M18 52 L32 40 L46 52" fill={primary} />
      <rect x="26" y="58" width="8" height="12" rx="1" fill={paper} />
      <path
        d="M52 60 H68"
        stroke={secondary}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M62 52 L72 60 L62 68"
        stroke={secondary}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="74" y="48" width="28" height="28" rx="4" fill={secondary} opacity={0.9} />
      <path d="M74 52 L88 40 L102 52" fill={secondary} />
      <rect x="82" y="58" width="8" height="12" rx="1" fill={paper} />
    </Box>
  );
}
