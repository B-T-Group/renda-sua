import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { CommonActions } from '@react-navigation/native';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessOrder } from '../../types/business/orders';
import type { ConfirmOrderPayload } from '../../types/business/orders';
import { rootNavigationRef } from '@/navigation/rootNavigationRef';
import { isStorePayAfterConfirmOrder, foodServiceStyle } from '../../utils/cookedFoodOrder';
import { EatInIllustration } from '../illustrations/EatInIllustration';
import { TakeOutIllustration } from '../illustrations/TakeOutIllustration';
import { PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES } from '../../utils/payAfterConfirm';

const PRESETS = [15, 30, 45, 60] as const;
const MIN_CUSTOM = 5;
const MAX_CUSTOM = 180;

function navigateBusinessRoute(
  name: 'BusinessDashboard' | 'BusinessOrdersList',
  params?: { queue: 'prep' }
) {
  if (!rootNavigationRef.isReady()) return;
  rootNavigationRef.dispatch(CommonActions.navigate({ name, params }));
}

type ConfirmResponse = {
  success: boolean;
  message?: string;
  pay_after_merchant_confirm?: boolean;
};

interface Props {
  visible: boolean;
  order: BusinessOrder | null;
  onDismiss: () => void;
  onConfirm: (payload: ConfirmOrderPayload) => Promise<ConfirmResponse>;
}

function ReadyClock({ color }: { color: string }) {
  return (
    <Svg width={96} height={96} viewBox="0 0 120 120" accessibilityLabel="Ready time">
      <Circle cx="60" cy="60" r="48" stroke={color} strokeWidth={4} fill="none" opacity={0.25} />
      <Circle cx="60" cy="60" r="6" fill={color} />
      <Line x1="60" y1="60" x2="60" y2="28" stroke={color} strokeWidth={4} strokeLinecap="round" />
      <Line x1="60" y1="60" x2="82" y2="72" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
    </Svg>
  );
}

export function CookedFoodConfirmOrderDialog({
  visible,
  order,
  onDismiss,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<number | 'custom'>(30);
  const [customMinutes, setCustomMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [noTable, setNoTable] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSelected(30);
    setCustomMinutes('');
    setError(null);
    setNoTable(false);
  }, [visible, order?.id]);

  const resolveMinutes = useCallback((): number | null => {
    if (selected !== 'custom') return selected;
    const parsed = Number.parseInt(customMinutes, 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < MIN_CUSTOM || parsed > MAX_CUSTOM) return null;
    return parsed;
  }, [customMinutes, selected]);

  // Flagged-location goods: no ready-in prompt; explain pay-after + auto-cancel.
  const storePayAfter = order ? isStorePayAfterConfirmOrder(order) : false;

  const handleSubmit = async (eatInUnavailable = false) => {
    if (!order) return;
    const readyInMinutes = storePayAfter ? undefined : resolveMinutes();
    if (!storePayAfter && readyInMinutes == null) {
      setError(
        t(
          'orders.cookedFood.invalidReadyMinutes',
          'Enter a ready time between {{min}} and {{max}} minutes.',
          { min: MIN_CUSTOM, max: MAX_CUSTOM }
        )
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await onConfirm({
        orderId: order.id,
        ...(readyInMinutes != null ? { ready_in_minutes: readyInMinutes } : {}),
        ...(eatInUnavailable ? { eat_in_unavailable: true } : {}),
      });
      if (eatInUnavailable) setNoTable(true);
      if (result.pay_after_merchant_confirm) {
        setStep(2);
      } else {
        onDismiss();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('business.orders.confirmFailed', 'Failed to confirm'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return null;

  const isPickup = order.fulfillment_method === 'pickup' || order.is_cooked_food_pickup === true;
  const serviceStyle = foodServiceStyle(order);
  const serviceLabel =
    serviceStyle === 'eat_in'
      ? t('orders.eatIn.eatIn', 'Eat in')
      : serviceStyle === 'take_out'
        ? t('orders.eatIn.takeOut', 'Take out')
        : isPickup
          ? t('orders.cookedFood.pickup', 'Pickup')
          : t('orders.cookedFood.delivery', 'Delivery');
  const readyMinutes = resolveMinutes();

  return (
    <>
      <Portal>
        <Modal
          visible={visible && !submitting}
          onDismiss={onDismiss}
          contentContainerStyle={[
            styles.sheet,
            {
              width,
              height,
              backgroundColor: colors.surface,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text variant="labelLarge" style={{ color: colors.text.secondary }}>
              {t('orders.cookedFood.orderLabel', 'Order #{{number}}', {
                number: order.order_number,
              })}
              {' · '}
              {serviceLabel}
            </Text>
            <Text variant="titleLarge" style={{ marginTop: spacing.xs }}>
              {storePayAfter
                ? step === 1
                  ? t('orders.payAfterConfirm.business.confirmTitle', 'Confirm this order')
                  : t('orders.payAfterConfirm.business.waitPaymentTitle', 'Wait for payment before preparing')
                : step === 1
                  ? t('orders.cookedFood.confirmTitle', 'When will it be ready?')
                  : t('orders.cookedFood.waitPaymentTitle', 'Do not start cooking yet')}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            {serviceStyle && step === 1 ? (
              <View style={{ alignItems: 'center' }}>
                {serviceStyle === 'eat_in' ? <EatInIllustration /> : <TakeOutIllustration />}
              </View>
            ) : null}
            {storePayAfter ? (
              step === 1 ? (
                <StoreConfirmBody error={error} />
              ) : (
                <StoreWaitPaymentBody isPickup={isPickup} />
              )
            ) : step === 1 ? (
              <ReadyTimeBody
                order={order}
                selected={selected}
                customMinutes={customMinutes}
                readyMinutes={readyMinutes}
                error={error}
                submitting={submitting}
                onSelect={setSelected}
                onCustomChange={setCustomMinutes}
              />
            ) : (
              <WaitPaymentBody isPickup={isPickup} noTable={noTable} />
            )}
          </ScrollView>
          <View style={[styles.actions, { paddingHorizontal: spacing.lg, gap: spacing.sm }]}>
            {step === 1 ? (
              <>
                <Button
                  mode="contained"
                  loading={submitting}
                  disabled={!storePayAfter && readyMinutes == null}
                  onPress={() => void handleSubmit(false)}
                >
                  {storePayAfter
                    ? t('orders.payAfterConfirm.business.confirmCta', 'Confirm order')
                    : readyMinutes == null
                    ? t('orders.cookedFood.confirmReady', 'Confirm ready time')
                    : t('orders.cookedFood.confirmReadyMinutes', 'Confirm · {{m}} min', {
                        m: readyMinutes,
                      })}
                </Button>
                {order.eat_in === true ? (
                  <Button
                    mode="outlined"
                    disabled={submitting || (!storePayAfter && readyMinutes == null)}
                    onPress={() => void handleSubmit(true)}
                  >
                    {t('orders.eatIn.noTable', 'No table')}
                  </Button>
                ) : null}
                <Button onPress={onDismiss} disabled={submitting}>
                  {t('common.back', 'Back')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  mode="contained"
                  onPress={() => {
                    onDismiss();
                    navigateBusinessRoute('BusinessDashboard');
                  }}
                >
                  {t('orders.cookedFood.returnDashboard', 'Return to dashboard')}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => {
                    onDismiss();
                    // Pay-after orders awaiting payment sit in the Prep queue.
                    navigateBusinessRoute(
                      'BusinessOrdersList',
                      storePayAfter ? { queue: 'prep' } : undefined
                    );
                  }}
                >
                  {storePayAfter
                    ? t('orders.payAfterConfirm.business.viewOrders', 'View orders')
                    : t('orders.cookedFood.viewOrdersToCook', 'View orders to cook')}
                </Button>
              </>
            )}
          </View>
        </Modal>
      </Portal>
      <ActionLoadingDialog visible={submitting} action="confirm_order" />
    </>
  );
}

function StoreConfirmBody({ error }: { error: string | null }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="bodyLarge" style={{ color: colors.text.primary }}>
        {t(
          'orders.payAfterConfirm.business.confirmBody',
          'After you confirm, the client is asked to pay by Mobile Money. They have {{m}} minutes; unpaid orders are cancelled automatically and the stock is released.',
          { m: PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES }
        )}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t(
          'orders.payAfterConfirm.business.confirmHint',
          'Do not prepare the order until you see the payment. Once it is paid, mark it ready when prepared. If you cannot fulfil a paid order, you can cancel it and the client is refunded.'
        )}
      </Text>
      {error ? (
        <Text style={{ color: colors.error.main, textAlign: 'center' }} variant="bodySmall">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function StoreWaitPaymentBody({ isPickup }: { isPickup: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const steps = [
    t('orders.payAfterConfirm.business.waitStepSent', 'A Mobile Money request is on the client’s phone.'),
    t('orders.payAfterConfirm.business.waitStepWait', 'Wait for the payment notification ({{m}} minutes).', {
      m: PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES,
    }),
    t('orders.payAfterConfirm.business.waitStepPrepare', 'Prepare the order only after you see that payment, then mark it ready.'),
  ];
  return (
    <View style={{ gap: spacing.md }}>
      {steps.map((label, i) => (
        <Text key={label} variant="bodyMedium" style={{ color: colors.text.primary }}>
          {i + 1}. {label}
        </Text>
      ))}
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {isPickup
          ? t(
              'orders.payAfterConfirm.business.waitPickup',
              'When it is ready, the client picks it up and completes the order in the app.'
            )
          : t(
              'orders.payAfterConfirm.business.waitDelivery',
              'When it is ready, a courier picks it up for delivery.'
            )}
      </Text>
    </View>
  );
}

function ReadyTimeBody({
  order,
  selected,
  customMinutes,
  readyMinutes,
  error,
  submitting,
  onSelect,
  onCustomChange,
}: {
  order: BusinessOrder;
  selected: number | 'custom';
  customMinutes: string;
  readyMinutes: number | null;
  error: string | null;
  submitting: boolean;
  onSelect: (value: number | 'custom') => void;
  onCustomChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const options: Array<number | 'custom'> = [...PRESETS, 'custom'];
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center' }}>
        <ReadyClock color={colors.primary.main} />
      </View>
      <DishSummary order={order} />
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
        {t(
          'orders.cookedFood.readyHint',
          'Tell the client how long you need. They pay after you confirm. Start cooking only after that payment arrives.'
        )}
      </Text>
      <View style={styles.grid}>
        {options.map((option) => (
          <MinuteTile
            key={String(option)}
            label={
              option === 'custom'
                ? t('orders.cookedFood.customChip', 'Custom')
                : t('orders.cookedFood.minutesChip', '{{m}} min', { m: option })
            }
            selected={selected === option}
            disabled={submitting}
            onPress={() => onSelect(option)}
          />
        ))}
      </View>
      {selected === 'custom' ? (
        <TextInput
          mode="outlined"
          label={t('orders.cookedFood.customMinutes', 'Minutes until ready')}
          value={customMinutes}
          onChangeText={(value) => onCustomChange(value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          disabled={submitting}
        />
      ) : null}
      {selected === 'custom' ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {t('orders.cookedFood.customHelp', 'Whole number from {{min}} to {{max}}.', {
            min: MIN_CUSTOM,
            max: MAX_CUSTOM,
          })}
        </Text>
      ) : null}
      {readyMinutes != null ? (
        <Text variant="titleMedium" style={{ textAlign: 'center', fontWeight: '700' }}>
          {t('orders.cookedFood.readyIn', 'Ready in {{m}} minutes', { m: readyMinutes })}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ color: colors.error.main, textAlign: 'center' }} variant="bodySmall">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function DishSummary({ order }: { order: BusinessOrder }) {
  const lines = order.order_items ?? [];
  if (lines.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line) => (
        <Text key={line.id} variant="titleMedium" style={{ textAlign: 'center', fontWeight: '700' }}>
          {line.quantity}× {line.item_name || line.item?.name || ''}
        </Text>
      ))}
    </View>
  );
}

function MinuteTile({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        paddingVertical: 16,
        borderRadius: borderRadius.md,
        borderWidth: 2,
        borderColor: selected ? colors.primary.main : colors.divider,
        backgroundColor: selected ? colors.primary.main : colors.surface,
        alignItems: 'center',
      }}
    >
      <Text
        variant="titleMedium"
        style={{ color: selected ? colors.primary.contrast : colors.text.primary, fontWeight: '700' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function WaitPaymentBody({
  isPickup,
  noTable = false,
}: {
  isPickup: boolean;
  noTable?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const steps = [
    t('orders.cookedFood.waitStepSent', 'A Mobile Money request is on the client’s phone.'),
    t('orders.cookedFood.waitStepWait', 'Wait for the payment notification.'),
    t('orders.cookedFood.waitStepCook', 'Start cooking only after you see that payment.'),
  ];
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center' }}>
        {noTable ? <TakeOutIllustration /> : <ReadyClock color={colors.warning.main} />}
      </View>
      {noTable ? (
        <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
          {t(
            'orders.eatIn.noTableKitchen',
            'There is no table. The customer was told. If they approve the payment, prepare this as take out.'
          )}
        </Text>
      ) : null}
      {steps.map((label, index) => (
        <View key={label} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Text variant="titleMedium" style={{ fontWeight: '700', width: 22 }}>
            {index + 1}
          </Text>
          <Text variant="bodyMedium" style={{ flex: 1, color: colors.text.primary }}>
            {label}
          </Text>
        </View>
      ))}
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {isPickup
          ? t(
              'orders.cookedFood.waitPickup',
              'When it is ready, the client picks it up and completes the order in the app.'
            )
          : t(
              'orders.cookedFood.waitDelivery',
              'When it is ready, a courier picks it up for delivery.'
            )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { margin: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { marginTop: 'auto' },
});
