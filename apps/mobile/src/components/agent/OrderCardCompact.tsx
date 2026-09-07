import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme/shadows';
import { DeliveryStatusIndicator, statusToTone, statusToLabel } from './DeliveryStatusIndicator';
import type { Order } from '../../types/agent';
import { buildDeliveryOrderViewModel } from '../../orders/model/buildDeliveryOrderViewModel';
import { useOrderViewModelContext } from '../../orders/model/useOrderViewModelContext';
import { getTotalItemQuantity } from '../../utils/orderCardHelpers';

export interface OrderCardCompactProps {
  order: Order;
  onAccept: () => void;
  onViewDetails: () => void;
  isBusy?: boolean;
  /** When false, shows setup CTA label; tap still calls onAccept. */
  claimEnabled?: boolean;
  acceptLabel?: string;
}

function formatAddress(
  addr: { address_line_1?: string; city?: string } | undefined
): string {
  if (!addr) return '—';
  return [addr.address_line_1, addr.city].filter(Boolean).join(', ');
}

function formatCurrency(amount: number | undefined, currency: string): string {
  if (amount == null) return '—';
  return `${currency} ${amount.toFixed(0)}`;
}

/**
 * Compact order card for the Available Orders list.
 * Shows only: order #, earnings, pickup→dropoff, item count.
 * Secondary info is behind "View Details".
 */
export function OrderCardCompact({
  order,
  onAccept,
  onViewDetails,
  isBusy = false,
  claimEnabled = true,
  acceptLabel,
}: OrderCardCompactProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const vmCtx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildDeliveryOrderViewModel(order, vmCtx),
    [order, vmCtx]
  );
  const quantity = getTotalItemQuantity(order);
  const commission = vm.earnings.estimatedTotal ?? vm.earnings.commission ?? order.delivery_commission ?? 0;
  const currency = vm.earnings.currency ?? order.currency ?? 'XAF';
  const isExpress = order.requires_fast_delivery;

  return (
    <Pressable
      onPress={onViewDetails}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderColor: colors.divider,
          opacity: pressed ? 0.93 : 1,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {/* Header row: order # + commission */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text
            variant="titleSmall"
            style={[styles.orderNumber, { color: colors.text.primary }]}
          >
            {t('agent.openOrders.orderNumber', '#{{num}}', { num: order.order_number })}
          </Text>
          {isExpress && (
            <View
              style={[
                styles.expressBadge,
                { backgroundColor: colors.warning.main + '18', borderRadius: borderRadius.xs },
              ]}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={10} color={colors.warning.dark} />
              <Text style={[styles.expressLabel, { color: colors.warning.dark }]}>
                {t('agent.openOrders.fastDelivery', 'Express')}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.commissionBox, { backgroundColor: colors.success.main + '18', borderRadius: borderRadius.sm }]}>
          <Text style={[styles.commissionAmount, { color: colors.success.dark }]}>
            {formatCurrency(commission, currency)}
          </Text>
        </View>
      </View>

      {/* Route row: pickup → dropoff */}
      <View style={styles.routeRow}>
        <MaterialCommunityIcons name="store-outline" size={14} color={colors.text.secondary} />
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={[styles.routeText, { color: colors.text.secondary, flex: 1 }]}
        >
          {formatAddress(order.business_location?.address)}
        </Text>
        {order.pickup_distance_km != null && Number.isFinite(order.pickup_distance_km) && (
          <Text
            variant="labelSmall"
            style={[styles.distanceBadge, { color: colors.primary.main }]}
          >
            {t('agent.openOrders.approxPickupDistance', '~{{km}} km away', {
              km: order.pickup_distance_km.toFixed(1),
            })}
          </Text>
        )}
      </View>
      <View style={[styles.routeConnector, { paddingLeft: 7 }]}>
        <View style={[styles.connector, { backgroundColor: colors.divider }]} />
      </View>
      <View style={styles.routeRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.primary.main} />
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={[styles.routeText, { color: colors.text.secondary, flex: 1 }]}
        >
          {formatAddress(order.delivery_address)}
        </Text>
      </View>

      {/* Meta row: item count */}
      <View style={styles.metaRow}>
        <MaterialCommunityIcons name="package-variant" size={13} color={colors.text.disabled} />
        <Text variant="bodySmall" style={[styles.metaText, { color: colors.text.disabled }]}>
          {t('agent.openOrders.itemCount', '{{count}} item', { count: quantity, defaultValue_plural: '{{count}} items' })}
        </Text>
        <View style={styles.metaSpacer} />
        <Pressable onPress={onViewDetails} hitSlop={8}>
          <Text
            variant="labelSmall"
            style={[styles.detailsLink, { color: colors.primary.main }]}
          >
            {t('agent.openOrders.viewOrderDetail', 'Details')} →
          </Text>
        </Pressable>
      </View>

      {/* CTA */}
      <Button
        mode={claimEnabled ? 'contained' : 'outlined'}
        onPress={onAccept}
        loading={isBusy}
        disabled={isBusy}
        compact
        icon={claimEnabled ? undefined : 'lock-outline'}
        style={[styles.ctaButton, { borderRadius: borderRadius.button }]}
        labelStyle={styles.ctaLabel}
        contentStyle={styles.ctaContent}
      >
        {acceptLabel ??
          (claimEnabled
            ? t('agent.openOrders.claimButton', 'Accept Delivery')
            : t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim'))}
      </Button>
    </Pressable>
  );
}

/**
 * Compact card for Active Orders list.
 * Shows: status, next action label, order #, earnings, and primary CTA.
 */
export interface OrderCardActiveProps {
  order: Order;
  onPrimaryAction: () => void;
  onViewDetails: () => void;
  primaryActionLabel: string;
  isBusy?: boolean;
}

export function OrderCardActive({
  order,
  onPrimaryAction,
  onViewDetails,
  primaryActionLabel,
  isBusy = false,
}: OrderCardActiveProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const vmCtx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildDeliveryOrderViewModel(order, vmCtx),
    [order, vmCtx]
  );
  const commission = vm.earnings.estimatedTotal ?? vm.earnings.commission ?? order.delivery_commission ?? 0;
  const currency = vm.earnings.currency ?? order.currency ?? 'XAF';
  const tone = statusToTone(order.current_status);
  const statusLabel = statusToLabel(order.current_status, t);
  const isExpress = order.requires_fast_delivery;
  const quantity = getTotalItemQuantity(order);

  return (
    <Pressable
      onPress={onViewDetails}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderColor: colors.divider,
          opacity: pressed ? 0.93 : 1,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {/* Status + earnings header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <DeliveryStatusIndicator label={statusLabel} tone={tone} compact />
          {isExpress && (
            <View
              style={[
                styles.expressBadge,
                { backgroundColor: colors.warning.main + '18', borderRadius: borderRadius.xs },
              ]}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={10} color={colors.warning.dark} />
              <Text style={[styles.expressLabel, { color: colors.warning.dark }]}>
                {t('agent.openOrders.fastDelivery', 'Express')}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.commissionBox, { backgroundColor: colors.success.main + '18', borderRadius: borderRadius.sm }]}>
          <Text style={[styles.commissionAmount, { color: colors.success.dark }]}>
            {formatCurrency(commission, currency)}
          </Text>
        </View>
      </View>

      <Text variant="labelLarge" style={{ color: colors.text.primary, fontWeight: '700', marginBottom: 4 }}>
        {vm.currentObjective}
      </Text>

      {/* Order number + item count */}
      <View style={styles.orderMetaRow}>
        <Text variant="titleSmall" style={[styles.orderNumber, { color: colors.text.primary }]}>
          {t('agent.openOrders.orderNumber', '#{{num}}', { num: order.order_number })}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {'•'}
        </Text>
        <MaterialCommunityIcons name="package-variant" size={13} color={colors.text.disabled} />
        <Text variant="bodySmall" style={[styles.metaText, { color: colors.text.disabled }]}>
          {t('agent.openOrders.itemCount', '{{count}} item', { count: quantity, defaultValue_plural: '{{count}} items' })}
        </Text>
        <View style={styles.metaSpacer} />
        <Pressable onPress={onViewDetails} hitSlop={8}>
          <Text variant="labelSmall" style={[styles.detailsLink, { color: colors.primary.main }]}>
            {t('common.details', 'Details')} →
          </Text>
        </Pressable>
      </View>

      {/* Delivery address */}
      <View style={styles.routeRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.primary.main} />
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={[styles.routeText, { color: colors.text.secondary, flex: 1 }]}
        >
          {formatAddress(order.delivery_address)}
        </Text>
      </View>

      {/* Primary CTA */}
      <Button
        mode="contained"
        onPress={onPrimaryAction}
        loading={isBusy}
        disabled={isBusy}
        compact
        style={[styles.ctaButton, { borderRadius: borderRadius.button }]}
        labelStyle={styles.ctaLabel}
        contentStyle={styles.ctaContent}
      >
        {primaryActionLabel}
      </Button>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNumber: {
    fontWeight: '700',
  },
  commissionBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  commissionAmount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  expressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  expressLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeConnector: {
    paddingLeft: 7,
    height: 8,
    justifyContent: 'center',
  },
  connector: {
    width: 1,
    height: 8,
  },
  routeText: {
    lineHeight: 16,
  },
  distanceBadge: {
    fontWeight: '700',
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    lineHeight: 16,
  },
  metaSpacer: {
    flex: 1,
  },
  detailsLink: {
    fontWeight: '600',
  },
  ctaButton: {
    marginTop: 2,
  },
  ctaLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaContent: {
    height: 40,
  },
});
