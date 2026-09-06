import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type { DeliveryRequirement } from '../../orders/model';

export interface DeliveryRequirementsCardProps {
  requirements: DeliveryRequirement[];
}

export function DeliveryRequirementsCard({ requirements }: DeliveryRequirementsCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  if (requirements.length === 0) return null;

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
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ fontWeight: '700' }}>
        {t('orders.delivery.requirementsTitle', 'Delivery requirements')}
      </Text>
      <View style={[styles.chipRow, { gap: spacing.xs }]}>
        {requirements.map((r) => (
          <StatusPill
            key={r.id}
            compact
            label={r.label}
            backgroundColor={colors.warning.main + '22'}
            textColor={colors.warning.main}
            borderColor={colors.warning.main + '55'}
            icon="alert-circle-outline"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
