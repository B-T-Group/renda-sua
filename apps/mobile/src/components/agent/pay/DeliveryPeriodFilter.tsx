import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { DeliveryEarningsPeriod } from '../../../types/agentDeliveryEarnings';

const PERIODS: Array<{ id: DeliveryEarningsPeriod; labelKey: string; fallback: string }> = [
  { id: 'month', labelKey: 'agent.pay.deliveries.month', fallback: 'This month' },
  { id: 'last_month', labelKey: 'agent.pay.deliveries.lastMonth', fallback: 'Last month' },
  { id: 'all', labelKey: 'agent.pay.deliveries.all', fallback: 'All' },
];

export function DeliveryPeriodFilter({
  value,
  onChange,
}: {
  value: DeliveryEarningsPeriod;
  onChange: (period: DeliveryEarningsPeriod) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
      {PERIODS.map((period) => {
        const selected = period.id === value;
        return (
          <Pressable
            key={period.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(period.id)}
            style={[
              styles.pill,
              {
                backgroundColor: selected ? colors.primaryTint : colors.surface,
                borderRadius: borderRadius.full,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Text variant="labelLarge" style={{ color: selected ? colors.primary.main : colors.text.secondary }}>
              {t(period.labelKey, period.fallback)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
