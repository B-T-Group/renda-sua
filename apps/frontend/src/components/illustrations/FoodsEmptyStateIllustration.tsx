import { Box, useTheme } from '@mui/material';

/** A covered dish with a clock, for "no dishes being served yet". */
export function FoodsEmptyStateIllustration({ size = 140 }: { size?: number }) {
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
      aria-label="No dishes are being served yet"
      sx={{ display: 'block', mx: 'auto' }}
    >
      <circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
      <path
        d="M26 74 H94"
        stroke={primary}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M32 72 A28 28 0 0 1 88 72 Z" fill={primary} opacity={0.85} />
      <circle cx="60" cy="40" r="4" fill={paper} />
      <path
        d="M46 84 H74"
        stroke={primary}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
        fill="none"
      />
      <circle cx="88" cy="88" r="16" fill={paper} />
      <circle
        cx="88"
        cy="88"
        r="16"
        fill="none"
        stroke={secondary}
        strokeWidth={3}
      />
      <path
        d="M88 80 V88 L94 92"
        stroke={secondary}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Box>
  );
}

export default FoodsEmptyStateIllustration;
