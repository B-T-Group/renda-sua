import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CreatedRentalItemSummary } from './FirstRentalItemCreateStep';

interface FirstRentalItemSuccessStepProps {
  item: CreatedRentalItemSummary;
}

const FirstRentalItemSuccessStep: React.FC<FirstRentalItemSuccessStepProps> = ({
  item,
}) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
      <CheckIcon color="success" sx={{ fontSize: 56 }} />
      <Typography variant="h5" textAlign="center">
        {t(
          'business.onboarding.firstRental.success.title',
          'Your first rental is set up'
        )}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {t(
          'business.onboarding.firstRental.success.body',
          '{{name}} has a listing at your location. You can add more listings or photos anytime.',
          { name: item.name }
        )}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
        }}
      >
        <Button variant="contained" component={RouterLink} to="/dashboard">
          {t(
            'business.onboarding.firstRental.success.dashboard',
            'Back to dashboard'
          )}
        </Button>
        <Button
          variant="outlined"
          component={RouterLink}
          to={`/business/rentals/items/${item.id}`}
        >
          {t(
            'business.onboarding.firstRental.success.viewItem',
            'View rental item'
          )}
        </Button>
      </Box>
    </Stack>
  );
};

export default FirstRentalItemSuccessStep;
