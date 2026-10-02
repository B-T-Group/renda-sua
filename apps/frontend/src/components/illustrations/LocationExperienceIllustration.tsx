import { Box, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

/** Small storefront mark for the customer-experience summary. */
const LocationExperienceIllustration: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const ink = theme.palette.primary.main;
  const soft = theme.palette.primary.light;
  return (
    <Box
      component="svg"
      role="img"
      aria-label={t(
        'business.locations.expectations.title',
        'What your customers will experience'
      )}
      viewBox="0 0 72 56"
      width={72}
      height={56}
      sx={{ flexShrink: 0 }}
    >
      <rect x="8" y="18" width="56" height="30" rx="4" fill={soft} />
      <path d="M6 20 L36 6 L66 20" fill="none" stroke={ink} strokeWidth="3" />
      <rect x="30" y="30" width="12" height="18" rx="2" fill={ink} />
    </Box>
  );
};

export default LocationExperienceIllustration;
