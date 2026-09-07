import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Divider, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { shadows } from '../../theme/shadows';
import { useLanguage } from '../../hooks/useLanguage';
import type { BusinessOrder } from '../../types/business/orders';
import { buildBusinessOrderViewModel } from '../../orders/model/buildBusinessOrderViewModel';
import { useOrderViewModelContext } from '../../orders/model/useOrderViewModelContext';
import {
  deliveryAddressOneLine,
  orderStatusStripeColor,
} from '../../utils/clientOrderListDisplay';
import {
  businessOrderAgentLabel,
  businessOrderItemTitle,
  businessOrderLineCount,
  businessOrderPickupLocation,
  businessOrderUnitsCount,
  formatOrderTimeWindowLabel,
  isStorePickupOrder,
  orderListThumbUrls,
} from '../../utils/businessOrderListDisplay';
import { formatCurrency } from '../../utils/formatters';
import { resolveOrderPricing } from '../../utils/orderAmounts';
import { BusinessOrderRowActions } from './BusinessOrderRowActions';
import { OrderItemThumbStack } from './OrderItemThumbStack';

export interface BusinessOrderListRowProps {
  order: BusinessOrder;
  onPressDetails?: () => void;
  onOrderMutated?: () => void;
}

export function BusinessOrderListRow({
  order,
  onPressDetails,
  onOrderMutated,
}: BusinessOrderListRowProps) {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const locale = currentLanguage === 'fr' ? 'fr-FR' : 'en-US';
  const { colors, spacing, borderRadius } = useTheme();
  const vmCtx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildBusinessOrderViewModel(order, vmCtx),
    [order, vmCtx]
  );

  const status = order.current_status || 'unknown';
  const statusLabel = vm.statusMessage;
  const cur = order.currency || 'XAF';
  const stripeColor = useMemo(() => orderStatusStripeColor(status, colors), [status, colors]);
  const pricing = useMemo(() => resolveOrderPricing(order), [order]);
  const itemTitle = useMemo(() => businessOrderItemTitle(order), [order]);
  const pickupLoc = useMemo(() => businessOrderPickupLocation(order), [order]);
  const deliveryLine = useMemo(() => deliveryAddressOneLine(order), [order]);
  const agentLabel = useMemo(() => businessOrderAgentLabel(order), [order]);
  const isPickup = isStorePickupOrder(order);
  const units = businessOrderUnitsCount(order);
  const lineCount = businessOrderLineCount(order);
  const thumbUrls = useMemo(() => orderListThumbUrls(order), [order]);
  const slotLabel = useMemo(
    () => formatOrderTimeWindowLabel(order, locale),
    [order, locale]
  );

  const clientName =
    vm.customer?.name ||
    [order.client?.user?.first_name, order.client?.user?.last_name]
      .filter(Boolean)
      .join(' ');

  const chipTint = stripeColor + '28';
  const chipBorder = stripeColor + '55';
  const pendingCash = order.reconciliation_status === 'pending_manual_reconciliation';

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View
        style={[
          {
            flexDirection: 'row',
            borderRadius: borderRadius.card,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.divider,
            backgroundColor: colors.surface,
          },
          shadows.sm,
        ]}
      >
        <View style={{ width: 4, backgroundColor: stripeColor }} />
        <View style={{ flex: 1, padding: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              marginBottom: spacing.sm,
            }}
          >
            <Text variant="titleSmall" style={{ fontWeight: '700', color: colors.text.primary }}>
              #{order.order_number}
            </Text>
            <StatusPill
              compact
              label={statusLabel}
              backgroundColor={chipTint}
              borderColor={chipBorder}
              textColor={colors.text.primary}
            />
            {vm.requiredAction && vm.primaryActionId !== 'none' ? (
              <StatusPill
                compact
                icon="clipboard-check-outline"
                label={vm.requiredAction}
                backgroundColor={colors.warning.main + '22'}
                textColor={colors.warning.dark}
              />
            ) : null}
            {units > 0 ? (
              <StatusPill
                compact
                icon="package-variant-closed"
                label={t('business.orders.card.unitsBadge', '{{count}} units', { count: units })}
                backgroundColor={colors.primaryTint}
                textColor={colors.primary.main}
              />
            ) : null}
            {pendingCash ? (
              <StatusPill
                compact
                icon="cash"
                label={t('business.orders.cashPending', 'Cash recon.')}
                backgroundColor={colors.warningTint}
                textColor={colors.text.primary}
              />
            ) : null}
            {order.acceptance_state === 'scheduled' ? (
              <StatusPill
                compact
                icon="clock-outline"
                label={
                  order.acceptance_activates_at
                    ? t('business.orders.scheduledActivates', 'Activates {{when}}', {
                        when: new Date(order.acceptance_activates_at).toLocaleString(locale, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }),
                      })
                    : t('business.orders.scheduled', 'Scheduled')
                }
                backgroundColor={colors.primaryTint}
                textColor={colors.primary.main}
              />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <OrderItemThumbStack
              urls={thumbUrls}
              overflowCount={Math.max(0, lineCount - thumbUrls.length)}
            />

            <View style={{ flex: 1, minWidth: 0 }}>
              {itemTitle ? (
                <Text variant="titleMedium" style={{ fontWeight: '600', color: colors.text.primary }} numberOfLines={2}>
                  {itemTitle}
                </Text>
              ) : null}
              {clientName ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }} numberOfLines={1}>
                  {clientName}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.sm, gap: 6 }}>
                {pickupLoc ? (
                  <MetaRow
                    icon="store-outline"
                    label={t('business.orders.card.pickupLocation', 'Pickup')}
                    value={pickupLoc}
                    colors={colors}
                  />
                ) : null}
                {slotLabel ? (
                  <MetaRow
                    icon="clock-outline"
                    label={
                      isPickup
                        ? t('business.orders.card.pickupSlot', 'Pickup slot')
                        : t('business.orders.card.deliverySlot', 'Delivery slot')
                    }
                    value={slotLabel}
                    colors={colors}
                  />
                ) : null}
                {!isPickup && deliveryLine ? (
                  <MetaRow
                    icon="map-marker-outline"
                    label={t('business.orders.card.deliveryTo', 'Deliver to')}
                    value={deliveryLine}
                    colors={colors}
                  />
                ) : null}
                {!isPickup ? (
                  <MetaRow
                    icon="account-tie-outline"
                    label={t('business.orders.card.agent', 'Agent')}
                    value={
                      agentLabel ??
                      t('business.orders.card.unassignedAgent', 'Not assigned yet')
                    }
                    colors={colors}
                    muted={!agentLabel}
                  />
                ) : null}
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.md,
              marginTop: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.divider,
            }}
          >
            <PricePill
              label={t('business.orders.card.itemSubtotal', 'Items')}
              amount={pricing.subtotal}
              currency={cur}
              locale={locale}
              colors={colors}
            />
            {!isPickup ? (
              <PricePill
                label={t('business.orders.card.deliveryFee', 'Delivery')}
                amount={pricing.deliveryFee}
                currency={cur}
                locale={locale}
                colors={colors}
              />
            ) : null}
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                {t('business.orders.card.total', 'Total')}
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.primary.main }}>
                {formatCurrency(pricing.total, cur, locale)}
              </Text>
            </View>
          </View>

          <BusinessOrderRowActions order={order} onSuccess={onOrderMutated} />

          {onPressDetails ? (
            <>
              <Divider style={{ marginVertical: spacing.md }} />
              <Pressable
                onPress={onPressDetails}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 4,
                  opacity: pressed ? 0.85 : 1,
                })}
                accessibilityRole="button"
              >
                <Text variant="labelLarge" style={{ color: colors.primary.main, fontWeight: '600' }}>
                  {t('business.orders.card.viewDetails', 'Full details')}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary.main} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
  colors,
  muted,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.text.secondary} style={{ marginTop: 2 }} />
      <Text variant="bodySmall" style={{ flex: 1, color: muted ? colors.text.disabled : colors.text.secondary }} numberOfLines={2}>
        <Text style={{ fontWeight: '600', color: colors.text.primary }}>{label}: </Text>
        {value}
      </Text>
    </View>
  );
}

function PricePill({
  label,
  amount,
  currency,
  locale,
  colors,
}: {
  label: string;
  amount: number;
  currency: string;
  locale: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View>
      <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ fontWeight: '600', color: colors.text.primary }}>
        {formatCurrency(amount, currency, locale)}
      </Text>
    </View>
  );
}
