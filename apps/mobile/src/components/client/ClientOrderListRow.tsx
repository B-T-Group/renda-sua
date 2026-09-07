import { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type { Order } from '../../types/agent';
import { buildClientOrderViewModel } from '../../orders/model/buildClientOrderViewModel';
import { useOrderViewModelContext } from '../../orders/model/useOrderViewModelContext';
import {
  formatOrderDeliveryScheduleLabel,
  orderListHeroImageUrl,
  orderStatusStripeColor,
} from '../../utils/clientOrderListDisplay';
import { formatCurrency } from '../../utils/formatters';
import { resolveOrderPricing } from '../../utils/orderAmounts';
import { ClientOrderRowActions } from './ClientOrderRowActions';
import { ClientOrderJourneyCard } from './ClientOrderJourneyCard';

export interface ClientOrderListRowProps {
  order: Order;
  locale: string;
  onPress?: () => void;
  onOrderMutated?: () => void;
  /** Navigate to the order detail with the rating mode that is actually available. */
  onRatePress?: (mode: 'agent' | 'item') => void;
}

const THUMB = 56;

function isCancelledClientOrder(status: string) {
  return ['cancelled', 'failed', 'refunded'].includes(status);
}

function ClientOrderListRowInner({
  order,
  locale,
  onPress,
  onOrderMutated,
  onRatePress,
}: ClientOrderListRowProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const vmCtx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildClientOrderViewModel(order, vmCtx),
    [order, vmCtx]
  );
  const status = order.current_status || 'unknown';
  const statusLabel = vm.statusMessage;
  const cur = order.currency || 'XAF';
  const cancelled = isCancelledClientOrder(status);

  const pricing = useMemo(() => resolveOrderPricing(order), [order]);
  const heroUri = useMemo(() => orderListHeroImageUrl(order), [order]);
  const schedule = useMemo(() => formatOrderDeliveryScheduleLabel(order), [order]);
  const stripeColor = useMemo(() => orderStatusStripeColor(status, colors), [status, colors]);

  const businessLabel =
    vm.businessName ||
    order.business?.name?.trim() ||
    order.business_location?.name?.trim() ||
    '';

  const chipTint = stripeColor + '28';
  const chipBorder = stripeColor + '55';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${t('orders.details', 'Details')} #${order.order_number}`}
      style={({ pressed }) => [
        styles.pressable,
        { marginBottom: spacing.sm, opacity: pressed && onPress ? 0.92 : 1 },
      ]}
    >
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderRadius: borderRadius.card,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {/* Status stripe */}
        <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

        <View style={styles.body}>
          {/* Row 1: Order number + status badge + fast-delivery badge */}
          <View style={styles.headerRow}>
            <Text style={[styles.orderNumber, { color: colors.text.primary }]} numberOfLines={1}>
              #{order.order_number}
            </Text>
            <View style={styles.badgeRow}>
              <StatusPill
                compact
                label={statusLabel}
                backgroundColor={chipTint}
                borderColor={chipBorder}
                textColor={stripeColor}
              />
              {order.requires_fast_delivery ? (
                <StatusPill
                  compact
                  icon="flash"
                  label={t('orders.fastDelivery.title', 'Fast Delivery')}
                  backgroundColor={colors.warning.light + '55'}
                  borderColor={colors.warning.main + '66'}
                  textColor={colors.warning.dark}
                />
              ) : null}
            </View>
          </View>

          <ClientOrderJourneyCard order={order} variant="compact" />

          {/* Row 2: Thumb + store + price */}
          <View style={styles.mainRow}>
            <View
              style={[
                styles.thumb,
                {
                  borderRadius: borderRadius.sm,
                  backgroundColor: colors.divider,
                },
              ]}
            >
              {heroUri ? (
                <Image source={{ uri: heroUri }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <MaterialCommunityIcons name="package-variant" size={28} color={colors.text.secondary} />
              )}
            </View>

            <View style={styles.storeCol}>
              {businessLabel ? (
                <Text style={[styles.storeName, { color: colors.text.primary }]} numberOfLines={1}>
                  {businessLabel}
                </Text>
              ) : null}

              {schedule ? (
                <View style={styles.scheduleRow}>
                  <MaterialCommunityIcons name="calendar-clock" size={13} color={colors.text.secondary} />
                  <Text style={[styles.scheduleText, { color: colors.text.secondary }]} numberOfLines={2}>
                    {schedule}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.priceCol}>
              <Text style={[styles.price, { color: colors.primary.main }]}>
                {formatCurrency(pricing.total, cur, locale)}
              </Text>
              {cancelled ? (
                <Text style={[styles.priceNote, { color: colors.error.main }]}>
                  {t('orders.cancelled', 'Cancelled')}
                </Text>
              ) : pricing.deliveryFee > 0 ? (
                <Text style={[styles.priceNote, { color: colors.text.secondary }]} numberOfLines={2}>
                  {t('orders.inclDelivery', 'incl.')}{' '}
                  {formatCurrency(pricing.deliveryFee, cur, locale)}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Primary CTA actions */}
          <ClientOrderRowActions
            order={order}
            onOrderMutated={onOrderMutated}
            onRatePress={onRatePress}
          />

          {/* Details link */}
          {onPress ? (
            <View style={[styles.detailsRow, { borderTopColor: colors.divider }]}>
              <Text style={[styles.detailsLabel, { color: colors.primary.main }]}>
                {t('orders.details', 'Details')}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary.main} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const ClientOrderListRow = memo(ClientOrderListRowInner);

const styles = StyleSheet.create({
  pressable: {},
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbImg: {
    width: THUMB,
    height: THUMB,
  },
  storeCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  scheduleText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  priceCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '35%',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  priceNote: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 2,
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
