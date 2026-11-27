import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { RentalMerchantEarnings } from '../../types/rentals';
import { formatRequestAmount } from '../../utils/rentals/rentalRequestFormat';
import { commissionPercent } from '../../utils/rentals/commission';
import { CommissionRow } from './CommissionRows';
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
  const { colors, typography, borderRadius, spacing } = useTheme();
  const money = (n: number | null) => (n == null ? '—' : formatRequestAmount(n, earnings.currency, i18n.language));
  const [statusKey, statusDefault] = STATUS_COPY[earnings.status];
  const waived = earnings.status === 'waived';
  return (
    <View
      testID="merchant-earnings"
      style={{
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.md,
      }}
    >
      <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
        {t('rentals.commission.earningsTitle', 'Your earnings')}
      </Text>
      {waived ? null : (
        <CommissionSplitIllustration
          commissionShare={(earnings.rate_bps ?? 0) / 10000}
          label={t('rentals.commission.illustrationLabel', 'Rental total split between you and Rendasua')}
        />
      )}
      <CommissionRow label={t('rentals.commission.subtotal', 'Rental subtotal')} value={money(earnings.base_amount)} />
      {waived ? null : (
        <CommissionRow
          label={t('rentals.commission.fee', 'Rendasua commission ({{rate}}%)', { rate: commissionPercent(earnings.rate_bps ?? 0) })}
          value={`− ${money(earnings.commission_amount)}`}
        />
      )}
      {waived ? null : (
        <CommissionRow label={t('rentals.commission.youReceive', 'You receive')} value={money(earnings.merchant_payout_amount)} strong />
      )}
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 6 }}>
        {t(statusKey, statusDefault)}
      </Text>
    </View>
  );
}
