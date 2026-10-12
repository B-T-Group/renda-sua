import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatCurrency } from '../../../utils/formatters';
import type { DeliveryTrip } from '../../../types/agentDeliveryEarnings';

export function DeliveryTripCard({ trip, currency }: { trip: DeliveryTrip; currency: string }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          padding: spacing.md,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary, flex: 1 }}>
        {t('agent.pay.deliveries.orderNumber', 'Order {{number}}', {
          number: trip.orderNumber || trip.orderId,
        })}
      </Text>
      <View style={styles.meta}>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {formatWhen(trip.deliveredAt)}
        </Text>
        <Text variant="titleSmall" style={{ color: colors.text.primary }}>
          {formatCurrency(trip.amount, currency)}
        </Text>
      </View>
    </View>
  );
}

function formatWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
