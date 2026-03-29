import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

interface FirstSaleItemSuccessStepProps {
  item: CreatedSaleItemSummary;
  intent?: SaleItemFromImageIntent;
}

const FirstSaleItemSuccessStep: React.FC<FirstSaleItemSuccessStepProps> = ({
  item,
  intent = 'first',
}) => {
  const { t } = useTranslation();
  const isFirst = intent === 'first';
  return (
    <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
      <CheckIcon color="success" sx={{ fontSize: 56 }} />
      <Typography variant="h5" textAlign="center">
        {isFirst
          ? t(
              'business.onboarding.firstSale.success.title',
              'Your first product is live'
            )
          : t(
              'business.onboarding.firstSale.success.titleAdditional',
              'Your product is live'
            )}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {t(
          isFirst
            ? 'business.onboarding.firstSale.success.body'
            : 'business.onboarding.firstSale.success.bodyAdditional',
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
          to={isFirst ? '/dashboard' : '/business/items'}
        >
          {isFirst
            ? t(
                'business.onboarding.firstSale.success.dashboard',
                'Back to dashboard'
              )
            : t(
                'business.onboarding.firstSale.success.backToItems',
                'Back to items'
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
