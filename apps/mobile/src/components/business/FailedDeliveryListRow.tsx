import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { FailedDelivery } from '../../types/business/failedDeliveries';
import { failedDeliveryPersonName } from '../../types/business/failedDeliveries';
import { formatCurrency, formatDate } from '../../utils/formatters';

type Props = {
  item: FailedDelivery;
  onPress: () => void;
};

function failureReasonLabel(item: FailedDelivery, lang: string): string {
  const fr = item.failure_reason?.reason_fr?.trim();
  const en = item.failure_reason?.reason_en?.trim();
  if (lang.startsWith('fr')) return fr || en || item.failure_reason_id;
  return en || fr || item.failure_reason_id;
}

export const FailedDeliveryListRow = memo(function FailedDeliveryListRow({
  item,
  onPress,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const clientName = failedDeliveryPersonName(item.order?.client?.user);
  const agentName = failedDeliveryPersonName(item.order?.assigned_agent?.user);
  const reason = failureReasonLabel(item, i18n.language);
  const amount = formatCurrency(
    item.order?.total_amount,
    item.order?.currency,
    i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US'
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(
        'business.failedDeliveries.rowA11y',
        'Failed delivery for order {{orderNumber}}',
        { orderNumber: item.order?.order_number }
      )}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <Text
          style={[typography.subheading, { color: colors.primary.main, flex: 1 }]}
          numberOfLines={1}
        >
          #{item.order?.order_number}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {formatDate(item.created_at, 'relative')}
        </Text>
      </View>

      <View
        style={[
          styles.reasonPill,
          {
            backgroundColor: colors.errorTint,
            borderRadius: borderRadius.sm,
            marginTop: spacing.xs,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={14}
          color={colors.error.dark}
        />
        <Text
          style={[typography.caption, { color: colors.error.dark, flex: 1 }]}
          numberOfLines={2}
        >
          {reason}
        </Text>
      </View>

      <View style={[styles.metaCol, { marginTop: spacing.sm, gap: spacing.xxs }]}>
        {clientName ? (
          <MetaLine
            icon="account-outline"
            label={t('business.failedDeliveries.client', 'Client')}
            value={clientName}
          />
        ) : null}
        {agentName ? (
          <MetaLine
            icon="moped-outline"
            label={t('business.failedDeliveries.agent', 'Agent')}
            value={agentName}
          />
        ) : null}
        <MetaLine
          icon="cash"
          label={t('business.failedDeliveries.amount', 'Amount')}
          value={amount}
        />
        {item.notes?.trim() ? (
          <Text
            style={[typography.caption, { color: colors.text.secondary }]}
            numberOfLines={2}
          >
            {t('business.failedDeliveries.agentNotes', 'Agent notes')}:{' '}
            {item.notes.trim()}
          </Text>
        ) : null}
      </View>

      <View style={[styles.footer, { marginTop: spacing.sm }]}>
        <Text style={[typography.caption, { color: colors.primary.main }]}>
          {t('business.failedDeliveries.tapToResolve', 'Tap to resolve')}
        </Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color={colors.primary.main}
        />
      </View>
    </Pressable>
  );
});

function MetaLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={[styles.metaRow, { gap: spacing.xs }]}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.text.secondary} />
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {label}:
      </Text>
      <Text
        style={[typography.caption, { color: colors.text.primary, flex: 1, fontWeight: '600' }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metaCol: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
});
