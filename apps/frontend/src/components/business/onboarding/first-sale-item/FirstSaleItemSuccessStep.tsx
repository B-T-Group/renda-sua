import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

interface FirstSaleItemSuccessStepProps {
  item: CreatedSaleItemSummary;
  intent?: SaleItemFromImageIntent;
  locationName?: string;
  savedAsDraft?: boolean;
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
  savedAsDraft = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isFirst = intent === 'first';

  const title = savedAsDraft
    ? t('business.onboarding.firstSale.success.draftTitle', 'Draft saved')
    : isFirst
      ? t(
          'business.onboarding.firstSale.success.title',
          'Your first product was submitted'
        )
      : t(
          'business.onboarding.firstSale.success.titleAdditional',
          'Product submitted for approval'
        );

  const bodyText = savedAsDraft
    ? locationName
      ? t(
          'business.onboarding.firstSale.success.draftBodyWithLocation',
          '{{name}} is saved as a draft at {{locationName}}. Open the product and publish when you are ready for review.',
          { name: item.name, locationName }
        )
      : t(
          'business.onboarding.firstSale.success.draftBody',
          '{{name}} is saved as a draft. Open the product and publish when you are ready for review.',
          { name: item.name }
        )
    : locationName
      ? t(
          isFirst
            ? 'business.onboarding.firstSale.success.bodyWithLocation'
            : 'business.onboarding.firstSale.success.bodyAdditionalWithLocation',
          '{{name}} is stocked at {{locationName}} and awaits review before it appears in the public catalog.',
          { name: item.name, locationName }
        )
      : t(
          isFirst
            ? 'business.onboarding.firstSale.success.body'
            : 'business.onboarding.firstSale.success.bodyAdditional',
          '{{name}} awaits review before it appears in the public catalog.',
          { name: item.name }
        );

  return (
    <Stack
      spacing={3}
      alignItems="center"
      sx={{ py: { xs: 1, sm: 2 }, px: { xs: 0.5, sm: 0 } }}
    >
      <Box
        sx={{
          ...scaleIn,
          animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        <CheckIcon color="success" sx={{ fontSize: 64 }} />
      </Box>
      <Typography variant="h5" textAlign="center" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {bodyText}
      </Typography>
      <Stack spacing={1} sx={{ width: '100%', maxWidth: 400 }}>
        {savedAsDraft ? (
          <Button
            variant="contained"
            component={RouterLink}
            to={`/business/items/${item.id}`}
            fullWidth
            size="large"
            sx={{ minHeight: 48 }}
          >
            {t(
              'business.onboarding.firstSale.success.publishFromItem',
              'Open product to publish'
            )}
          </Button>
        ) : (
          <Button
            variant="contained"
            component={RouterLink}
            to={isFirst ? '/dashboard' : '/business/items'}
            fullWidth
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
        )}
        <Button
          variant="outlined"
          component={RouterLink}
          to={
            savedAsDraft
              ? isFirst
                ? '/dashboard'
                : '/business/items'
              : `/business/items/${item.id}`
          }
          fullWidth
          size="large"
          sx={{ minHeight: 48 }}
        >
          {savedAsDraft
            ? isFirst
              ? t(
                  'business.onboarding.firstSale.success.dashboard',
                  'Back to dashboard'
                )
              : t(
                  'business.onboarding.firstSale.success.backToItems',
                  'Back to items'
                )
            : t('business.onboarding.firstSale.success.viewItem', 'View product')}
        </Button>
        {!isFirst && !savedAsDraft && (
          <Button
            variant="text"
            onClick={() => navigate('/business/items/add-from-image')}
            fullWidth
            size="large"
            sx={{ minHeight: 48 }}
          >
            {t(
              'business.onboarding.firstSale.success.addAnother',
              'Add another product'
            )}
          </Button>
        )}
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemSuccessStep;
