import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { DeliveryPayIllustration } from '../../illustrations/DeliveryPayIllustration';
import { formatCurrency } from '../../../utils/formatters';
import type { DeliveryPayRates } from '../../../types/agentDeliveryEarnings';

export function DeliveryRateCard({
  pay,
  currency,
}: {
  pay: DeliveryPayRates;
  currency: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const line = t(
    'agent.pay.deliveries.payLine',
    'Each delivery pays you {{base}}, plus {{perKm}} for every kilometer.',
    {
      base: formatCurrency(pay.baseAmount, currency),
      perKm: formatCurrency(pay.perKmAmount, currency),
    }
  );

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <DeliveryPayIllustration label={line} />
      <View style={styles.copy}>
        <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
          {line}
        </Text>
        <FastPayLine amount={pay.fastBaseAmount} currency={currency} />
      </View>
    </View>
  );
}

function FastPayLine({ amount, currency }: { amount: number | null; currency: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (amount == null) return null;
  return (
    <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
      {t('agent.pay.deliveries.fastPay', 'Fast deliveries pay {{base}}.', {
        base: formatCurrency(amount, currency),
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, gap: 4 },
});
