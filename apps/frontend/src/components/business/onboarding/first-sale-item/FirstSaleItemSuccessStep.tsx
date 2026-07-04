import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

interface FirstSaleItemSuccessStepProps {
  item: CreatedSaleItemSummary;
  intent?: SaleItemFromImageIntent;
  locationName?: string;
}

const scaleIn = {
  '@keyframes scaleIn': {
    from: { transform: 'scale(0.4)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
  },
};

const FirstSaleItemSuccessStep: React.FC<FirstSaleItemSuccessStepProps> = ({
  item,
  intent = 'first',
  locationName,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const isFirst = intent === 'first';

  const bodyText = locationName
    ? t(
        isFirst
          ? 'business.onboarding.firstSale.success.bodyWithLocation'
          : 'business.onboarding.firstSale.success.bodyAdditionalWithLocation',
        '{{name}} is on your catalog and available at {{locationName}}.',
        { name: item.name, locationName }
      )
    : t(
        isFirst
          ? 'business.onboarding.firstSale.success.body'
          : 'business.onboarding.firstSale.success.bodyAdditional',
        '{{name}} is on your catalog and available at the location you chose.',
        { name: item.name }
      );

  return (
    <Stack spacing={3} alignItems="center" sx={{ py: { xs: 1, sm: 2 }, px: { xs: 0.5, sm: 0 } }}>
      <Box
        sx={{
          ...scaleIn,
          animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        <CheckIcon color="success" sx={{ fontSize: 64 }} />
      </Box>
      <Typography variant="h5" textAlign="center" fontWeight={600}>
        {isFirst
          ? t('business.onboarding.firstSale.success.title', 'Your first product is live')
          : t('business.onboarding.firstSale.success.titleAdditional', 'Your product is live')}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {bodyText}
      </Typography>
      <Stack spacing={1} sx={{ width: '100%', maxWidth: 400 }}>
        <Button
          variant="contained"
          component={RouterLink}
          to={isFirst ? '/dashboard' : '/business/items'}
          fullWidth
          size="large"
          sx={{ minHeight: 48 }}
        >
          {isFirst
            ? t('business.onboarding.firstSale.success.dashboard', 'Back to dashboard')
            : t('business.onboarding.firstSale.success.backToItems', 'Back to items')}
        </Button>
        <Button
          variant="outlined"
          component={RouterLink}
          to={`/business/items/${item.id}`}
          fullWidth
          size="large"
          sx={{ minHeight: 48 }}
        >
          {t('business.onboarding.firstSale.success.viewItem', 'View product')}
        </Button>
        {!isFirst && (
          <Button
            variant="text"
            onClick={() => navigate('/business/items/add-from-image')}
            fullWidth
            size="large"
            sx={{ minHeight: 48 }}
          >
            {t('business.onboarding.firstSale.success.addAnother', 'Add another product')}
          </Button>
        )}
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemSuccessStep;
