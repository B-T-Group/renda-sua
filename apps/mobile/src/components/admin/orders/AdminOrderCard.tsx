import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import type { AdminOrderRow } from '../../../types/adminOrders';
import {
  formatOverdue,
  nextActionLabel,
  riskTypeLabel,
  statusText,
} from '../../../utils/adminOrderRisk';
import { StatusPill } from '../../common/StatusPill';
import { AdminOrderRiskPill } from './AdminOrderRiskPill';

export interface AdminOrderCardProps {
  order: AdminOrderRow;
  onPress: (orderId: string) => void;
}

export function AdminOrderCard({ order, onPress }: AdminOrderCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const leading = order.risk_incidents[0];
  const recommendation = nextActionLabel(t, order.next_action);
  const businessName =
    order.business_location?.name ??
    order.contacts.find((c) => c.role === 'business')?.name ??
    null;
  const agentName = order.contacts.find((c) => c.role === 'agent')?.name;

  return (
    <Pressable
      onPress={() => onPress(order.id)}
      accessibilityRole="button"
      accessibilityLabel={t('admin.orders.openOrder', 'Open order')}
      style={[
        styles.card,
        shadows.sm ?? {},
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.xs,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.xs }]}>
        <AdminOrderRiskPill level={order.risk_level} compact />
        <StatusPill
          label={statusText(order.current_status)}
          backgroundColor={colors.infoTint}
          textColor={colors.info.main}
          compact
        />
        {order.risk_acknowledged && order.risk_level !== 'none' ? (
          <StatusPill
            label={t('admin.orders.acknowledgedShort', 'Acknowledged')}
            backgroundColor={colors.surface}
            textColor={colors.text.secondary}
            borderColor={colors.divider}
            compact
          />
        ) : null}
      </View>

      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {order.order_number}
      </Text>

      {leading ? (
        <View>
          <Text style={[typography.body2, { color: colors.text.primary }]}>
            {riskTypeLabel(t, leading.risk_type)}
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {t('admin.orders.overdueBy', 'overdue by {{duration}}', {
              duration: formatOverdue(t, leading.overdue_minutes),
            })}
          </Text>
        </View>
      ) : (
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('admin.orders.onTrack', 'On track')}
        </Text>
      )}

      {recommendation ? (
        <Text style={[typography.caption, { color: colors.primary.main }]}>
          {recommendation}
        </Text>
      ) : null}

      <Text
        style={[typography.caption, { color: colors.text.secondary }]}
        numberOfLines={1}
      >
        {businessName ?? t('admin.orders.noBusiness', 'N/A')}
        {' · '}
        {agentName ?? t('admin.orders.noAgent', 'Unassigned')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
