import type { ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { Theme } from '../../theme';
import type { Order } from '../../types/agent';
import { APP_FEATURES } from '../../constants/appFeatures';
import { orderNeedsPayAtDeliveryAgentActions } from '../../utils/orderPaymentAgentActions';
import { isCarrierShipping } from '../../utils/fulfillmentMethod';

export interface AgentOrderListQuickActionsProps {
  order: Order;
  isBusy: boolean;
  disabled: boolean;
  onPickUp: () => void;
  onDropOrder: () => void;
  onStartTransit: () => void;
  onOutForDelivery: () => void;
  onCompleteDelivery: () => void;
  onMarkFailed: () => void;
  onRequestPayment: () => void;
  onMarkPaidCash: () => void;
}

const ICON_SZ = 15;

function ActionBtn({
  label,
  icon,
  onPress,
  variant,
  colors,
  typography,
  borderRadius,
  disabled,
  fullWidth,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  variant: 'filledPrimary' | 'filledSuccess' | 'filledWarning' | 'outlineDanger' | 'outlineMuted';
  colors: Theme['colors'];
  typography: Theme['typography'];
  borderRadius: Theme['borderRadius'];
  disabled: boolean;
  fullWidth?: boolean;
}) {
  const bg =
    variant === 'filledPrimary'
      ? colors.primary.main
      : variant === 'filledSuccess'
        ? colors.success.main
        : variant === 'filledWarning'
          ? colors.warning.main
          : 'transparent';
  const fg =
    variant === 'outlineDanger'
      ? colors.error.main
      : variant === 'outlineMuted'
        ? colors.text.secondary
        : variant === 'filledWarning'
          ? '#ffffff'
          : colors.primary.contrast;
  const border =
    variant === 'outlineDanger'
      ? colors.error.main
      : variant === 'outlineMuted'
        ? colors.text.secondary
        : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        fullWidth ? styles.btnFull : styles.btnHalf,
        {
          backgroundColor: bg,
          borderRadius: borderRadius.sm,
          borderWidth: variant.startsWith('outline') ? 1 : 0,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={ICON_SZ} color={fg} />
      <Text
        style={[typography.caption as object, styles.btnLabel, { color: fg, flex: 1, minWidth: 0 }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AgentOrderListQuickActions({
  order,
  isBusy,
  disabled,
  onPickUp,
  onDropOrder,
  onStartTransit,
  onOutForDelivery,
  onCompleteDelivery,
  onMarkFailed,
  onRequestPayment,
  onMarkPaidCash,
}: AgentOrderListQuickActionsProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const status = order.current_status || '';
  const blocked = disabled || isBusy;
  const payAt = orderNeedsPayAtDeliveryAgentActions(order);

  if (isCarrierShipping(order.fulfillment_method)) return null;

  const row = (children: ReactNode) => (
    <View style={styles.row}>{children}</View>
  );

  if (status === 'assigned_to_agent') {
    return (
      <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
        {row(
          <>
            <ActionBtn
              label={t('agent.orders.detail.pickUp', 'Pick up order')}
              icon="package-variant"
              onPress={onPickUp}
              variant="filledPrimary"
              colors={colors}
              typography={typography}
              borderRadius={borderRadius}
              disabled={blocked}
            />
            <ActionBtn
              label={t('agent.orders.detail.dropOrder', 'Drop order')}
              icon="exit-run"
              onPress={onDropOrder}
              variant="outlineMuted"
              colors={colors}
              typography={typography}
              borderRadius={borderRadius}
              disabled={blocked}
            />
          </>
        )}
      </View>
    );
  }

  if (status === 'picked_up') {
    return (
      <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
        {APP_FEATURES.AGENT_MARK_AS_IN_TRANSIT
          ? row(
              <>
                <ActionBtn
                  label={t('agent.orders.detail.inTransit', 'In transit')}
                  icon="truck-delivery"
                  onPress={onStartTransit}
                  variant="filledPrimary"
                  colors={colors}
                  typography={typography}
                  borderRadius={borderRadius}
                  disabled={blocked}
                />
                <ActionBtn
                  label={t('agent.orders.detail.outForDelivery', 'Out for delivery')}
                  icon="map-marker-path"
                  onPress={onOutForDelivery}
                  variant="filledPrimary"
                  colors={colors}
                  typography={typography}
                  borderRadius={borderRadius}
                  disabled={blocked}
                />
              </>
            )
          : row(
              <ActionBtn
                label={t('agent.orders.detail.outForDelivery', 'Out for delivery')}
                icon="map-marker-path"
                onPress={onOutForDelivery}
                variant="filledPrimary"
                colors={colors}
                typography={typography}
                borderRadius={borderRadius}
                disabled={blocked}
              />
            )}
      </View>
    );
  }

  if (status === 'in_transit') {
    return (
      <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
        {row(
          <ActionBtn
            label={t('agent.orders.detail.outForDelivery', 'Out for delivery')}
            icon="map-marker-path"
            onPress={onOutForDelivery}
            variant="filledPrimary"
            colors={colors}
            typography={typography}
            borderRadius={borderRadius}
            disabled={blocked}
          />
        )}
      </View>
    );
  }

  if (status === 'out_for_delivery') {
    return (
      <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
        {payAt ? (
          <>
            {row(
              <>
                <ActionBtn
                  label={t('agent.orders.payAtDelivery.requestPayment', { defaultValue: 'Request payment' })}
                  icon="cellphone-message"
                  onPress={onRequestPayment}
                  variant="filledSuccess"
                  colors={colors}
                  typography={typography}
                  borderRadius={borderRadius}
                  disabled={blocked}
                />
                <ActionBtn
                  label={t('agent.orders.payAtDelivery.markPaidInCash', { defaultValue: 'Mark paid in cash' })}
                  icon="cash-multiple"
                  onPress={onMarkPaidCash}
                  variant="filledWarning"
                  colors={colors}
                  typography={typography}
                  borderRadius={borderRadius}
                  disabled={blocked}
                />
              </>
            )}
            {row(
              <ActionBtn
                label={t('orderActions.markAsFailed', 'Mark as failed')}
                icon="close-circle"
                onPress={onMarkFailed}
                variant="outlineDanger"
                colors={colors}
                typography={typography}
                borderRadius={borderRadius}
                disabled={blocked}
                fullWidth
              />
            )}
          </>
        ) : (
          row(
            <>
              <ActionBtn
                label={t('orderActions.completeDelivery', 'Complete delivery')}
                icon="check-circle"
                onPress={onCompleteDelivery}
                variant="filledSuccess"
                colors={colors}
                typography={typography}
                borderRadius={borderRadius}
                disabled={blocked}
              />
              <ActionBtn
                label={t('orderActions.markAsFailed', 'Mark as failed')}
                icon="close-circle"
                onPress={onMarkFailed}
                variant="outlineDanger"
                colors={colors}
                typography={typography}
                borderRadius={borderRadius}
                disabled={blocked}
              />
            </>
          )
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 2,
    gap: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'stretch' },
  btn: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  btnHalf: {
    flex: 1,
    minWidth: 0,
  },
  btnFull: {
    width: '100%',
  },
  btnLabel: {
    fontWeight: '600',
    fontSize: 11.5,
    letterSpacing: 0.15,
    textAlign: 'center',
    flexShrink: 1,
  },
});
