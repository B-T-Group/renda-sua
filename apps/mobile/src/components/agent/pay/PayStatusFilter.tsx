import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { PayBoardStatus } from '../../../types/agentPayBoard';

const FILTERS: Array<{ id: PayBoardStatus; labelKey: string; fallback: string }> = [
  { id: 'unpaid', labelKey: 'agent.pay.filter.unpaid', fallback: 'Unpaid' },
  { id: 'paid', labelKey: 'agent.pay.filter.paid', fallback: 'Paid' },
  { id: 'expired', labelKey: 'agent.pay.filter.expired', fallback: 'Expired' },
  { id: 'all', labelKey: 'agent.pay.filter.all', fallback: 'All' },
];

export function PayStatusFilter({
  value,
  onChange,
  showExpired = false,
}: {
  value: PayBoardStatus;
  onChange: (status: PayBoardStatus) => void;
  showExpired?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
      {FILTERS.filter((filter) => showExpired || filter.id !== 'expired').map((filter) => {
        const selected = filter.id === value;
        const label = t(filter.labelKey, filter.fallback);
        return (
          <Pressable
            key={filter.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(filter.id)}
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
              {label}
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
