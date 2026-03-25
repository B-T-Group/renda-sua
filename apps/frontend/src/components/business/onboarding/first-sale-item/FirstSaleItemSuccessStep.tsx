import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';

interface FirstSaleItemSuccessStepProps {
  item: CreatedSaleItemSummary;
}

const FirstSaleItemSuccessStep: React.FC<FirstSaleItemSuccessStepProps> = ({
  item,
}) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
      <CheckIcon color="success" sx={{ fontSize: 56 }} />
      <Typography variant="h5" textAlign="center">
        {t(
          'business.onboarding.firstSale.success.title',
          'Your first product is live'
        )}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {t(
          'business.onboarding.firstSale.success.body',
          '{{name}} is on your catalog and available at the location you chose.',
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
        <Button
          variant="contained"
          component={RouterLink}
          to="/dashboard"
        >
          {t(
            'business.onboarding.firstSale.success.dashboard',
            'Back to dashboard'
          )}
        </Button>
        <Button
          variant="outlined"
          component={RouterLink}
          to={`/business/items/${item.id}`}
        >
          {t(
            'business.onboarding.firstSale.success.viewItem',
            'View product'
          )}
        </Button>
      </Box>
    </Stack>
  );
};

export default FirstSaleItemSuccessStep;
