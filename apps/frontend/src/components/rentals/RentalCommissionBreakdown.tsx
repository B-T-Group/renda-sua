import { Alert, Box, Skeleton, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRentalApi, type RentalCommissionPreview } from '../../hooks/useRentalApi';
import { formatRequestAmount } from '../../utils/rentalRequestDisplay';
import { CommissionSplitIllustration } from './CommissionSplitIllustration';
import { commissionPercent } from '../../utils/rentals/commission';

interface Props {
  requestId: string;
  /** Total after a rebate; the preview recomputes the commission on it. */
  totalOverride?: number;
  /** Bumped by the parent to force a reload (for example after a rate change). */
  refreshKey?: number;
  /** Reports the rate the business is looking at, or null when there is no commission. */
  onRateChange: (rateBps: number | null) => void;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 800 : 400}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 600}>
        {value}
      </Typography>
    </Stack>
  );
}

export const RentalCommissionBreakdown: React.FC<Props> = ({ requestId, totalOverride, refreshKey = 0, onRateChange }) => {
  const { t, i18n } = useTranslation();
  const { fetchCommissionPreview } = useRentalApi();
  const [preview, setPreview] = useState<RentalCommissionPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetchCommissionPreview(requestId, totalOverride)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        onRateChange(data.enabled ? data.rate_bps : null);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onRateChange(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCommissionPreview, onRateChange, refreshKey, requestId, totalOverride]);

  if (failed) {
    return <Alert severity="warning">{t('rentals.commission.loadFailed', 'Could not load the commission. Try again.')}</Alert>;
  }
  if (!preview) return <Skeleton variant="rounded" height={120} />;
  if (!preview.enabled) return null;

  const money = (n: number) => formatRequestAmount(n, preview.currency, i18n.language);
  const percent = commissionPercent(preview.rate_bps);
  return (
    <Box data-testid="rental-commission-breakdown" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">{t('rentals.commission.breakdownTitle', 'What you earn on this rental')}</Typography>
        <CommissionSplitIllustration
          commissionShare={preview.rate_bps / 10000}
          label={t('rentals.commission.illustrationLabel', 'Rental total split between you and Rendasua')}
        />
        <Row label={t('rentals.commission.subtotal', 'Rental subtotal')} value={money(preview.base_amount)} />
        <Row
          label={t('rentals.commission.fee', 'Rendasua commission ({{rate}}%)', { rate: percent })}
          value={`− ${money(preview.commission_amount)}`}
        />
        <Row label={t('rentals.commission.youReceive', 'You receive')} value={money(preview.merchant_payout_amount)} strong />
        {preview.campaign_code && preview.promo_ends_at ? (
          <Typography variant="caption" color="success.main">
            {t('rentals.commission.promo', 'Early-adopter rate until {{date}}', {
              date: new Date(preview.promo_ends_at).toLocaleDateString(i18n.language),
            })}
          </Typography>
        ) : null}
        <Typography variant="caption" color="text.secondary">
          {t(
            'rentals.commission.noRenterFee',
            'The renter pays no extra fee. The commission comes out of your payout, only when the rental is completed.'
          )}
        </Typography>
      </Stack>
    </Box>
  );
};
