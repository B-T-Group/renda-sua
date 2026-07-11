import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CreatedRentalItemSummary } from './FirstRentalItemCreateStep';

interface FirstRentalItemSuccessStepProps {
  item: CreatedRentalItemSummary;
  savedAsDraft?: boolean;
}

const FirstRentalItemSuccessStep: React.FC<FirstRentalItemSuccessStepProps> = ({
  item,
  savedAsDraft = false,
}) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
      <CheckIcon color="success" sx={{ fontSize: 56 }} />
      <Typography variant="h5" textAlign="center">
        {savedAsDraft
          ? t(
              'business.onboarding.firstRental.success.draftTitle',
              'Draft saved'
            )
          : t(
              'business.onboarding.firstRental.success.title',
              'Submitted for approval'
            )}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {savedAsDraft
          ? t(
              'business.onboarding.firstRental.success.draftBody',
              '{{name}} is saved as a draft at your location. Open the rental item and publish the listing when you are ready for review.',
              { name: item.name }
            )
          : t(
              'business.onboarding.firstRental.success.body',
              '{{name}} has a listing at your location and awaits review before it appears in the public catalog.',
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
        {savedAsDraft ? (
          <Button
            variant="contained"
            component={RouterLink}
            to={`/business/rentals/items/${item.id}`}
          >
            {t(
              'business.onboarding.firstRental.success.publishFromItem',
              'Open item to publish'
            )}
          </Button>
        ) : (
          <Button variant="contained" component={RouterLink} to="/dashboard">
            {t(
              'business.onboarding.firstRental.success.dashboard',
              'Back to dashboard'
            )}
          </Button>
        )}
        <Button
          variant="outlined"
          component={RouterLink}
          to={
            savedAsDraft
              ? '/dashboard'
              : `/business/rentals/items/${item.id}`
          }
        >
          {savedAsDraft
            ? t(
                'business.onboarding.firstRental.success.dashboard',
                'Back to dashboard'
              )
            : t(
                'business.onboarding.firstRental.success.viewItem',
                'View rental item'
              )}
        </Button>
      </Box>
    </Stack>
  );
};

export default FirstRentalItemSuccessStep;
