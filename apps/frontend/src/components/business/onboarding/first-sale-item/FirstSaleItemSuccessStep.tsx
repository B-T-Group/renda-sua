import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
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
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const isFirst = intent === 'first';
  return (
    <Stack spacing={3} alignItems="center" sx={{ py: { xs: 1, sm: 2 }, px: { xs: 0.5, sm: 0 } }}>
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
      <Stack
        spacing={1}
        sx={{ width: '100%', maxWidth: 400 }}
      >
        <Button
          variant="contained"
          component={RouterLink}
          to={isFirst ? '/dashboard' : '/business/items'}
          fullWidth={isNarrow}
          size="large"
          sx={{ minHeight: 48 }}
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
          fullWidth={isNarrow}
          size="large"
          sx={{ minHeight: 48 }}
        >
          {t(
            'business.onboarding.firstSale.success.viewItem',
            'View product'
          )}
        </Button>
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemSuccessStep;
