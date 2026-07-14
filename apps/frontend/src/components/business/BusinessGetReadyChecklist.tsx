import {
  CheckCircleOutline,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { BusinessVerificationStatus } from '../../hooks/useBusinessVerification';

export interface BusinessGetReadyChecklistProps {
  status: BusinessVerificationStatus | null;
  mainInterest: 'sell_items' | 'rent_items';
  itemCount: number;
  rentalItemCount: number;
}

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  to?: string;
  cta?: string;
};

export const BusinessGetReadyChecklist: React.FC<
  BusinessGetReadyChecklistProps
> = ({ status, mainInterest, itemCount, rentalItemCount }) => {
  const { t } = useTranslation();

  const isStripeRail = status?.paymentRail === 'stripe';
  const agreementDone = Boolean(status?.steps?.agreement?.complete);
  const payoutsDone = Boolean(status?.steps?.stripeConnect?.complete);
  const hasCatalog =
    mainInterest === 'rent_items' ? rentalItemCount > 0 : itemCount > 0;
  const allDone =
    agreementDone && hasCatalog && (!isStripeRail || payoutsDone);

  if (allDone) return null;

  const firstItemPath =
    mainInterest === 'rent_items'
      ? '/business/onboarding/add-rental-item'
      : '/business/onboarding/first-sale-item';

  const items: ChecklistItem[] = [
    {
      id: 'agreement',
      label: t('signup.getReady.stepAgreement', 'Sign merchant agreement'),
      done: agreementDone,
      to: '/business/merchant-agreement',
      cta: t('signup.getReady.ctaAgreement', 'Sign agreement'),
    },
    ...(isStripeRail
      ? [
          {
            id: 'payouts',
            label: t('signup.getReady.stepPayouts', 'Connect payouts'),
            done: payoutsDone,
            to: '/documents',
            cta: t('signup.getReady.ctaPayouts', 'Set up payouts'),
          } satisfies ChecklistItem,
        ]
      : []),
    {
      id: 'firstItem',
      label: t('signup.getReady.stepFirstItem', 'Add your first product'),
      done: hasCatalog,
      to: firstItemPath,
      cta: t('signup.getReady.ctaFirstItem', 'Add product'),
    },
  ];

  return (
    <Card sx={{ mb: 3, borderRadius: 2, border: 1, borderColor: 'primary.light' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('signup.getReady.title', 'Get ready to sell')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'signup.getReady.subtitle',
            'Complete these steps to go live and accept orders.'
          )}
        </Typography>
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                {item.done ? (
                  <CheckCircleOutline color="success" fontSize="small" sx={{ mt: 0.25 }} />
                ) : (
                  <RadioButtonUnchecked color="disabled" fontSize="small" sx={{ mt: 0.25 }} />
                )}
                <Typography
                  variant="body2"
                  color={item.done ? 'text.secondary' : 'text.primary'}
                  sx={{ textDecoration: item.done ? 'line-through' : 'none' }}
                >
                  {item.label}
                </Typography>
              </Box>
              {!item.done && item.to && item.cta ? (
                <Button
                  component={RouterLink}
                  to={item.to}
                  size="small"
                  variant="outlined"
                  sx={{ flexShrink: 0 }}
                >
                  {item.cta}
                </Button>
              ) : null}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};
