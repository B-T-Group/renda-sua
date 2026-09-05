import { ArrowForward } from '@mui/icons-material';
import { Button, Stack } from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { FB_ACCENT, FB_ACCENT_DARK, SIGNUP_SELL } from './forBusinessTheme';

interface SectionCTAProps {
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  primaryTo?: string;
  compact?: boolean;
}

const SectionCTA: React.FC<SectionCTAProps> = ({
  primaryLabel,
  secondaryLabel,
  secondaryTo,
  primaryTo = SIGNUP_SELL,
  compact = false,
}) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    spacing={1.5}
    justifyContent="center"
    alignItems="center"
    sx={{ mt: compact ? 3 : 5 }}
  >
    <Button
      component={RouterLink}
      to={primaryTo}
      variant="contained"
      size={compact ? 'medium' : 'large'}
      endIcon={<ArrowForward />}
      sx={{
        bgcolor: FB_ACCENT,
        fontWeight: 700,
        px: compact ? 3 : 4,
        '&:hover': { bgcolor: FB_ACCENT_DARK },
      }}
    >
      {primaryLabel}
    </Button>
    {secondaryLabel && secondaryTo ? (
      <Button
        component={RouterLink}
        to={secondaryTo}
        variant="outlined"
        size={compact ? 'medium' : 'large'}
        sx={{
          borderColor: FB_ACCENT,
          color: FB_ACCENT,
          fontWeight: 600,
          borderWidth: 2,
          '&:hover': { borderWidth: 2, borderColor: FB_ACCENT_DARK },
        }}
      >
        {secondaryLabel}
      </Button>
    ) : null}
  </Stack>
);

export default SectionCTA;
