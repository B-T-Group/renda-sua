import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { StatusPill } from '../../common/StatusPill';
import type { EarningItem } from '../../../types/agentPayBoard';

export function PayGenericCard({ item }: { item: EarningItem }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const paid = item.paymentStatus === 'paid';

  return (
    <View
      style={[
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          gap: spacing.xs,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="titleMedium" numberOfLines={2} style={[styles.title, { color: colors.text.primary }]}>
          {item.title || t('agent.pay.unknownTitle', 'Earning')}
        </Text>
        <StatusPill
          compact
          label={paid ? t('agent.pay.paid', 'Paid') : t('agent.pay.unpaid', 'To do')}
          backgroundColor={paid ? colors.successTint : colors.primaryTint}
          textColor={paid ? colors.success.dark : colors.primary.main}
        />
      </View>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t(`agent.pay.nextStep.${item.nextStep}`, item.nextStep)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, minWidth: 0 },
});
