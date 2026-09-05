import { CreditCard, Lock } from '@mui/icons-material';
import { Box, Divider, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatPayerChargeEstimate,
  type PayerChargeEstimate,
} from '../../utils/diasporaCheckout';

interface PayerChargeSummaryProps {
  estimate?: PayerChargeEstimate | null;
  /** Merchant-side total, already formatted in the merchant currency. */
  merchantPriceLabel: string;
  /** Recipient name, shown so the payer can confirm who receives the order. */
  recipientName?: string | null;
}

/**
 * The payer-facing money line. Stripe charges the merchant currency and the
 * card issuer sets the real rate, so the converted figure is always labelled as
 * an estimate and never as the amount that will be debited.
 */
const PayerChargeSummary: React.FC<PayerChargeSummaryProps> = ({
  estimate,
  merchantPriceLabel,
  recipientName,
}) => {
  const { t, i18n } = useTranslation();
  const estimateLabel = formatPayerChargeEstimate(estimate, i18n.language);

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 1.5 }} />
      {estimateLabel && (
        <Stack direction="row" spacing={1} alignItems="baseline">
          <CreditCard fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600}>
            {t('checkout.diaspora.payerCharge', "You'll pay ≈ {{amount}}", {
              amount: estimateLabel,
            })}
          </Typography>
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" display="block">
        {t('checkout.diaspora.merchantPrice', 'Merchant price {{amount}}', {
          amount: merchantPriceLabel,
        })}
      </Typography>
      {estimateLabel && (
        <Typography variant="caption" color="text.secondary" display="block">
          {t(
            'checkout.diaspora.fxDisclaimer',
            'Estimate only. Your card is charged in the merchant currency and your bank sets the final rate.'
          )}
        </Typography>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
        <Lock fontSize="small" color="success" />
        <Typography variant="caption" color="text.secondary">
          {recipientName?.trim()
            ? t(
                'checkout.diaspora.heldForRecipient',
                'Paid · Held until {{name}} receives the order',
                { name: recipientName.trim() }
              )
            : t(
                'checkout.diaspora.heldUntilHandover',
                'Paid · Held until delivery or pickup'
              )}
        </Typography>
      </Stack>
    </Box>
  );
};

export default PayerChargeSummary;
