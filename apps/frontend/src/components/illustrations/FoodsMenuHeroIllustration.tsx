import { Box, useTheme } from '@mui/material';

/** Covered dish plus a notification bell — order, kitchen prep, ready alert. */
export function FoodsMenuHeroIllustration({
  size = 120,
  label = 'Order food, restaurant prepares it, you get notified',
}: {
  size?: number;
  label?: string;
}) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const paper = theme.palette.background.paper;
  const alert = theme.palette.error.main;

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
      <circle cx="60" cy="60" r="54" fill={primary} opacity={0.12} />
      <path
        d="M22 78 H78"
        stroke={primary}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M28 76 A26 26 0 0 1 72 76 Z" fill={primary} opacity={0.88} />
      <circle cx="50" cy="48" r="4" fill={paper} />
      <path
        d="M36 86 H64"
        stroke={primary}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
        fill="none"
      />
      <circle cx="88" cy="38" r="18" fill={secondary} />
      <path
        d="M80 38 a8 8 0 0 1 16 0 c0 7-4 9-4 9 H84 s-4-2-4-9"
        fill={paper}
      />
      <rect x="86" y="26" width="4" height="5" rx="2" fill={paper} />
      <circle cx="98" cy="30" r="5" fill={alert} />
    </Box>
  );
}

export default FoodsMenuHeroIllustration;
