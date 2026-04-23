import { Payments, Smartphone } from '@mui/icons-material';
import { Box, type SxProps, type Theme } from '@mui/material';

type MobileMoneyOrderIconProps = {
  /** Optional style overrides. */
  sx?: SxProps<Theme>;
};

/**
 * Generic mobile-money affordance (phone + payment) for CTAs. Not a carrier mark.
 */
export function MobileMoneyOrderIcon({ sx }: MobileMoneyOrderIconProps) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'relative',
        display: 'inline-flex',
        width: 28,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...sx,
      }}
    >
      <Smartphone sx={{ fontSize: 24, display: 'block' }} />
      <Payments
        sx={{
          position: 'absolute',
          right: -2,
          bottom: 0,
          fontSize: 13,
        }}
      />
    </Box>
  );
}
