import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native-paper';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { rentalsApi } from '../../services/rentalsApi';
import type { RentalCommissionPreview } from '../../types/rentals';
import { formatRequestAmount } from '../../utils/rentals/rentalRequestFormat';
import { commissionPercent } from '../../utils/rentals/commission';
import { CommissionRow } from './CommissionRows';
import { CommissionSplitIllustration } from './CommissionSplitIllustration';

interface Props {
  requestId: string;
  /** Total after a rebate; the preview recomputes the commission on it. */
  totalOverride?: number;
  /** Bumped by the parent to force a reload (for example after a rate change). */
  refreshKey?: number;
  /** Reports the rate the business is looking at, or null when there is no commission. */
  onRateChange: (rateBps: number | null) => void;
}

export function RentalCommissionBreakdown({ requestId, totalOverride, refreshKey = 0, onRateChange }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const [preview, setPreview] = useState<RentalCommissionPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    rentalsApi
      .getCommissionPreview(requestId, totalOverride)
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
  }, [onRateChange, refreshKey, requestId, totalOverride]);

  if (failed) {
    return (
      <Text style={{ color: colors.warning.main, marginBottom: 8 }}>
        {t('rentals.commission.loadFailed', 'Could not load the commission. Try again.')}
      </Text>
    );
  }
  if (!preview) return <ActivityIndicator style={{ marginVertical: 8 }} />;
  if (!preview.enabled) return null;

  const money = (n: number) => formatRequestAmount(n, preview.currency, i18n.language);
  return (
    <View
      testID="rental-commission-breakdown"
      style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: 8 }}
    >
      <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('rentals.commission.breakdownTitle', 'What you earn on this rental')}
      </Text>
      <CommissionSplitIllustration
        commissionShare={preview.rate_bps / 10000}
        label={t('rentals.commission.illustrationLabel', 'Rental total split between you and Rendasua')}
      />
      <CommissionRow label={t('rentals.commission.subtotal', 'Rental subtotal')} value={money(preview.base_amount)} />
      <CommissionRow
        label={t('rentals.commission.fee', 'Rendasua commission ({{rate}}%)', { rate: commissionPercent(preview.rate_bps) })}
        value={`− ${money(preview.commission_amount)}`}
      />
      <CommissionRow label={t('rentals.commission.youReceive', 'You receive')} value={money(preview.merchant_payout_amount)} strong />
      {preview.campaign_code && preview.promo_ends_at ? (
        <Text variant="bodySmall" style={{ color: colors.success.main, marginTop: 6 }}>
          {t('rentals.commission.promo', 'Early-adopter rate until {{date}}', {
            date: new Date(preview.promo_ends_at).toLocaleDateString(i18n.language),
          })}
        </Text>
      ) : null}
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 6 }}>
        {t(
          'rentals.commission.noRenterFee',
          'The renter pays no extra fee. The commission comes out of your payout, only when the rental is completed.'
        )}
      </Text>
    </View>
  );
}
