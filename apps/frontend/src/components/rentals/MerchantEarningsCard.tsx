import { Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RentalMerchantEarnings } from '../../hooks/useRentalApi';
import { commissionPercent } from '../../utils/rentals/commission';
import { formatRequestAmount } from '../../utils/rentalRequestDisplay';
import { CommissionSplitIllustration } from './CommissionSplitIllustration';

const STATUS_COPY: Record<RentalMerchantEarnings['status'], [string, string]> = {
  quoted: ['rentals.commission.statusQuoted', 'Paid to you when the rental is completed'],
  earned: ['rentals.commission.statusEarned', 'Paid to your account'],
  reversed: ['rentals.commission.statusReversed', 'Commission refunded'],
  waived: ['rentals.commission.statusWaived', 'No commission: this booking did not go ahead'],
};

/** What the business earns on a booking. Only rendered for the owning business. */
export function MerchantEarningsCard({ earnings }: { earnings: RentalMerchantEarnings }) {
  const { t, i18n } = useTranslation();
  const money = (n: number | null) => (n == null ? '—' : formatRequestAmount(n, earnings.currency, i18n.language));
  const [statusKey, statusDefault] = STATUS_COPY[earnings.status];
  const waived = earnings.status === 'waived';
  return (
    <Paper elevation={0} data-testid="merchant-earnings" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={1}>
        <Typography variant="h6" fontWeight={900}>
          {t('rentals.commission.earningsTitle', 'Your earnings')}
        </Typography>
        {waived ? null : (
          <CommissionSplitIllustration
            commissionShare={(earnings.rate_bps ?? 0) / 10000}
            label={t('rentals.commission.illustrationLabel', 'Rental total split between you and Rendasua')}
          />
        )}
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">{t('rentals.commission.subtotal', 'Rental subtotal')}</Typography>
          <Typography variant="body2" fontWeight={600}>{money(earnings.base_amount)}</Typography>
        </Stack>
        {waived ? null : (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {t('rentals.commission.fee', 'Rendasua commission ({{rate}}%)', { rate: commissionPercent(earnings.rate_bps ?? 0) })}
            </Typography>
            <Typography variant="body2" fontWeight={600}>− {money(earnings.commission_amount)}</Typography>
          </Stack>
        )}
        {waived ? null : (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" fontWeight={800}>{t('rentals.commission.youReceive', 'You receive')}</Typography>
            <Typography variant="body2" fontWeight={800}>{money(earnings.merchant_payout_amount)}</Typography>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary">{t(statusKey, statusDefault)}</Typography>
      </Stack>
    </Paper>
  );
}
