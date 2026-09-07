import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { MoneyDisplay } from '../orders/shared';
import type { DeliveryEarnings } from '../../orders/model';

export interface DeliveryEarningsCardProps {
  earnings: DeliveryEarnings;
}

export function DeliveryEarningsCard({ earnings }: DeliveryEarningsCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const amount = earnings.estimatedTotal ?? earnings.commission;

  if (amount == null || amount <= 0) return null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.xs,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ fontWeight: '700' }}>
        {t('orders.delivery.earnings', 'Earnings')}
      </Text>
      <MoneyDisplay
        amount={amount}
        currency={earnings.currency}
        variant="headlineSmall"
        style={{ color: colors.success.main }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
