import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme/shadows';
import { DeliveryStatusIndicator, statusToTone, statusToLabel } from './DeliveryStatusIndicator';
import { StatusPill } from '../common/StatusPill';
import type { Order } from '../../types/agent';
import { buildDeliveryOrderViewModel } from '../../orders/model/buildDeliveryOrderViewModel';
import { useOrderViewModelContext } from '../../orders/model/useOrderViewModelContext';
import { getTotalItemQuantity } from '../../utils/orderCardHelpers';
import { formatKm } from '../../utils/formatKm';
import {
  agentDropoffFact,
  compactDropoff,
  formatFullAddress,
  storeToDropoffKm,
} from '../../utils/agentOpenOrderCard';
import { OrderCardUrgencyLine } from './OrderCardUrgencyLine';

export interface OrderCardCompactProps {
  order: Order;
  onAccept: () => void;
  onViewDetails: () => void;
  isBusy?: boolean;
  /** When false, shows setup CTA label; tap still calls onAccept. */
  claimEnabled?: boolean;
  acceptLabel?: string;
  /** Live dedicated-store location ids, used until the open-orders payload includes the flag. */
  dedicatedLocationIds?: ReadonlySet<string>;
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

function shortKm(label: string | null): string | null {
  if (label == null) return null;
  const value = Number(label);
  if (!Number.isFinite(value)) return label;
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return String(Math.round(value));
  return label;
}

function distanceLabel(km: number | null | undefined): string | null {
  return shortKm(formatKm(km));
}

/**
 * Available-order card: order number, commission, drop-off timing, and whether
 * the pickup is one of the agent's dedicated stores. Claim is separate from
 * the details tap.
 */
export function OrderCardCompact({
  order,
  onAccept,
  onViewDetails,
  isBusy = false,
  claimEnabled = true,
  acceptLabel,
  dedicatedLocationIds,
}: OrderCardCompactProps) {
  const { t, i18n } = useTranslation();
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
  const youToStoreKm = distanceLabel(order.pickup_distance_km);
  const storeToDropKm = distanceLabel(storeToDropoffKm(order));
  const dropoff = agentDropoffFact(order, i18n.language);
  const compact = dropoff?.kind === 'scheduled' ? compactDropoff(order, i18n.language) : null;
  const storeName = order.business_location?.name?.trim() || order.business?.name?.trim() || '';
  const locationId = order.business_location?.id;
  const isMyStore =
    order.my_dedicated_store === true ||
    (locationId != null && dedicatedLocationIds?.has(locationId) === true);
  const dayLabel =
    compact?.day === 'today'
      ? t('agent.openOrders.dropoffToday', 'Today')
      : compact?.day === 'tomorrow'
        ? t('agent.openOrders.dropoffTomorrow', 'Tomorrow')
        : compact?.dateLabel;
  const dropoffLabel =
    dropoff?.kind === 'asap'
      ? t('agent.openOrders.dropoffAsapShort', 'ASAP')
      : compact
        ? [dayLabel, compact.slot, compact.range].filter(Boolean).join(' · ')
        : dropoff?.kind === 'scheduled'
          ? t('agent.openOrders.dropoffScheduled', 'Scheduled drop-off')
          : null;
  const deliveryAddress = formatFullAddress(order.delivery_address);

  return (
    <View
      style={[
        styles.card,
        styles.openCard,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          borderColor: colors.divider,
          marginHorizontal: spacing.md,
          marginBottom: spacing.md,
          borderLeftWidth: isMyStore ? 3 : StyleSheet.hairlineWidth,
          borderLeftColor: isMyStore ? colors.primary.main : colors.divider,
        },
      ]}
    >
      <Pressable onPress={onViewDetails} accessibilityRole="button" style={styles.openBody}>
        <View style={styles.headerRow}>
          <Text variant="titleSmall" style={[styles.orderNumber, { color: colors.text.primary, flex: 1 }]}>
            {t('agent.openOrders.orderNumber', '#{{num}}', { num: order.order_number })}
          </Text>
          <View
            style={[
              styles.commissionBox,
              { backgroundColor: colors.success.main + '14', borderRadius: borderRadius.chip },
            ]}
          >
            <Text style={[styles.commissionAmount, { color: colors.success.dark }]}>
              {formatCurrency(commission, currency)}
            </Text>
          </View>
        </View>

        {dropoffLabel ? (
          <Text
            variant="titleSmall"
            numberOfLines={1}
            style={{ color: colors.text.primary, fontWeight: '600' }}
          >
            {isExpress ? `${t('agent.openOrders.fastDelivery', 'Express')} · ` : ''}
            {dropoffLabel}
          </Text>
        ) : null}

        {(storeName || isMyStore) ? (
          <View style={styles.storeRow}>
            {storeName ? (
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={{ color: colors.text.primary, flex: 1, minWidth: 0 }}
              >
                {storeName}
              </Text>
            ) : null}
            {isMyStore ? (
              <StatusPill
                compact
                icon="store"
                label={t('agent.openOrders.yourStore', 'Your store')}
                backgroundColor={colors.primaryTint}
                textColor={colors.primary.main}
              />
            ) : null}
          </View>
        ) : null}

        {youToStoreKm ? (
          <View style={styles.metaSoftRow}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.text.secondary} />
            <Text variant="bodySmall" style={{ color: colors.text.secondary, flex: 1 }}>
              {t('agent.openOrders.youToStore', 'Distance to pickup · {{km}} km', {
                km: youToStoreKm,
              })}
            </Text>
          </View>
        ) : null}

        {deliveryAddress ? (
          <View style={styles.metaSoftRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.primary.main} />
            <Text variant="bodySmall" style={{ color: colors.text.primary, flex: 1, lineHeight: 20 }}>
              {deliveryAddress}
            </Text>
          </View>
        ) : null}

        {storeToDropKm ? (
          <View style={styles.metaSoftRow}>
            <MaterialCommunityIcons name="routes" size={16} color={colors.text.secondary} />
            <Text variant="bodySmall" style={{ color: colors.text.secondary, flex: 1 }}>
              {t('agent.openOrders.storeToDropoff', 'Pickup to drop-off · {{km}} km', {
                km: storeToDropKm,
              })}
            </Text>
          </View>
        ) : null}

        <Text variant="labelSmall" style={{ color: colors.text.disabled, marginTop: 2 }}>
          {t('agent.openOrders.itemCount', '{{count}} item', {
            count: quantity,
            defaultValue_plural: '{{count}} items',
          })}
        </Text>
      </Pressable>

      <Button
        mode={claimEnabled ? 'contained' : 'outlined'}
        onPress={onAccept}
        loading={isBusy}
        disabled={isBusy}
        compact
        icon={claimEnabled ? undefined : 'lock-outline'}
        style={[styles.ctaButtonSoft, { borderRadius: borderRadius.button }]}
        labelStyle={styles.ctaLabel}
        contentStyle={styles.ctaContent}
      >
        {acceptLabel ??
          (claimEnabled
            ? t('agent.openOrders.claimButton', 'Accept Delivery')
            : t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim'))}
      </Button>
    </View>
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
      <OrderCardUrgencyLine urgency={vm.urgency} />

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
  openCard: {
    padding: 16,
    gap: 12,
  },
  openBody: {
    gap: 10,
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
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  commissionAmount: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaSoftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
  routeText: {
    lineHeight: 16,
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
  ctaButtonSoft: {
    marginTop: 4,
  },
  ctaLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaContent: {
    height: 44,
  },
});
