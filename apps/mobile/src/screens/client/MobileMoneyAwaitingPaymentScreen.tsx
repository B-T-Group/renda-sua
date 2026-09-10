import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { MobileMoneyConfirmIllustration } from '../../components/illustrations/MobileMoneyConfirmIllustration';
import { PaymentRetryView } from '../../components/checkout/PaymentRetryView';
import { AddPaymentPhoneDialog } from '../../components/dialogs/AddPaymentPhoneDialog';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobileMoneyPaymentPoll } from '../../hooks/useMobileMoneyPaymentPoll';
import type {
  ClientRootStackParamList,
  MobileMoneyAwaitingPaymentParams,
} from '../../navigation/types';
import { agentApi } from '../../services/agentApi';
import { maskPhoneE164 } from '../../utils/maskPhoneE164';
import { formatCurrency } from '../../utils/formatters';
import { remainingAfterDeposit } from '../../utils/depositResume';

export default function MobileMoneyAwaitingPaymentScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route =
    useRoute<
      RouteProp<
        { MobileMoneyAwaitingPayment: MobileMoneyAwaitingPaymentParams },
        'MobileMoneyAwaitingPayment'
      >
    >();
  const { 
    orderIds, 
    phoneE164, 
    source, 
    orderNumbers, 
    fulfillment,
    isDepositOrder: isDepositOrderParam,
    depositAmount: depositAmountParam,
    amountDue: amountDueParam,
    currency: currencyParam,
  } = route.params;
  const { state, error, stop, restart } = useMobileMoneyPaymentPoll(orderIds, {
    // Pickup remainder / full-pay must poll payment_status, not deposit_status.
    expectDeposit:
      isDepositOrderParam === true
        ? true
        : isDepositOrderParam === false || source === 'pickup'
          ? false
          : undefined,
  });
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [currentPhone, setCurrentPhone] = useState(phoneE164);
  const [editPhoneDialogVisible, setEditPhoneDialogVisible] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [orderData, setOrderData] = useState<{
    deposit_amount?: number;
    amount_due?: number;
    total_amount?: number;
    deposit_status?: string | null;
    currency?: string;
  } | null>(
    isDepositOrderParam
      ? {
          deposit_amount: depositAmountParam,
          amount_due: amountDueParam,
          currency: currencyParam || 'XAF',
        }
      : null
  );
  const masked = useMemo(() => maskPhoneE164(currentPhone), [currentPhone]);

  // Enrich from GET /orders/:id — route params often omit amountDue (preflight
  // keeps it on groups only). Need total_amount + deposit to compute remainder.
  useEffect(() => {
    if (!orderIds.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const order = await agentApi.orders.getById(orderIds[0]);
        if (!cancelled) {
          setOrderData({
            deposit_amount: order.deposit_amount ?? depositAmountParam,
            amount_due: order.amount_due ?? amountDueParam,
            total_amount: order.total_amount,
            deposit_status: order.deposit_status,
            currency: order.currency || currencyParam || 'XAF',
          });
        }
      } catch {
        // If fetch fails, continue with route-param copy
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    orderIds,
    isDepositOrderParam,
    depositAmountParam,
    amountDueParam,
    currencyParam,
  ]);

  const remainingAfterDepositAmount = useMemo(
    () =>
      remainingAfterDeposit({
        amount_due: amountDueParam ?? orderData?.amount_due,
        total_amount: orderData?.total_amount,
        deposit_amount: depositAmountParam ?? orderData?.deposit_amount,
        deposit_status: orderData?.deposit_status ?? 'paid',
      }),
    [
      amountDueParam,
      depositAmountParam,
      orderData?.amount_due,
      orderData?.total_amount,
      orderData?.deposit_amount,
      orderData?.deposit_status,
    ]
  );

  // Route param / pickup source are authoritative. Never infer deposit from
  // deposit_amount alone after deposit is already paid (remainder flow).
  const isDepositOrder =
    isDepositOrderParam === true ||
    (isDepositOrderParam == null &&
      source !== 'pickup' &&
      Boolean(orderData?.deposit_amount && orderData.deposit_amount > 0));

  const leaveToOrder = useCallback(() => {
    stop();
    const firstId = orderIds[0];
    if (firstId) {
      navigation.replace('OrderDetail', { orderId: firstId, backTo: 'home' });
      return;
    }
    navigation.navigate('ClientMainTabs', { screen: 'ClientOrders' });
  }, [navigation, orderIds, stop]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isDepositOrder 
        ? t('deposit.awaitingTitle', 'Approve deposit payment')
        : t('orders.momoAwaiting.navTitle', 'Approve payment'),
      headerBackTitle: t('common.back', 'Back'),
    });
  }, [navigation, t, isDepositOrder]);

  // Deposit fail/timeout: navigate back to checkout (order cancelled server-side).
  // No retry endpoint exists for deposits. Must land on Place Order or Cart for retry.
  const onBackToCheckout = useCallback(() => {
    stop();
    // Explicitly navigate to Cart (source is always 'checkout' for deposits from cart/place-order)
    // User must be able to edit phone and create a NEW order
    navigation.reset({
      index: 1,
      routes: [
        { name: 'ClientMainTabs' },
        { name: 'Cart' },
      ],
    });
  }, [navigation, stop]);

  // Retry payment: deposit orders call retryDepositPayment
  const onRetry = async () => {
    if (!orderIds.length) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const phone = currentPhone.trim() || undefined;
      await Promise.all(
        orderIds.map((id) => {
          if (isDepositOrder) {
            return agentApi.orders.retryDepositPayment(id, phone ? { phone_number: phone } : {});
          } else if (source === 'pickup') {
            return agentApi.orders.initiatePayAtPickupPayment(id, phone);
          } else {
            return agentApi.orders.retryPayment(
              id,
              phone ? { phone_number: phone } : {}
            );
          }
        })
      );
      restart();
    } catch (e: unknown) {
      setRetryError(
        e instanceof Error
          ? e.message
          : t('orders.momoAwaiting.retryError', 'Could not send another payment request.')
      );
    } finally {
      setRetrying(false);
    }
  };

  const onEditPhone = useCallback(() => {
    setEditPhoneDialogVisible(true);
  }, []);

  const onSavePhone = useCallback(
    async (newPhoneE164: string) => {
      setSavingPhone(true);
      try {
        setCurrentPhone(newPhoneE164);
        setEditPhoneDialogVisible(false);
      } catch (e: unknown) {
        // If there's an error, keep the dialog open
        throw e;
      } finally {
        setSavingPhone(false);
      }
    },
    []
  );

  const onDismissEditPhoneDialog = useCallback(() => {
    if (!savingPhone) {
      setEditPhoneDialogVisible(false);
    }
  }, [savingPhone]);

  const onContinueAfterPaid = () => {
    stop();
    if (source === 'checkout') {
      navigation.replace('OrderPlacedSuccess', {
        orderNumbers: orderNumbers?.length ? orderNumbers : orderIds,
        paymentTiming: 'pay_now',
        paymentCompleted: true,
        fulfillment,
      });
      return;
    }
    leaveToOrder();
  };

  const phase = state.phase;
  const waiting = phase === 'waiting';

  // When phase is 'failed', use PaymentRetryView or deposit-specific fail UI
  if (phase === 'failed') {
    const isOrderDetailSource = source === 'order-detail';
    // Place-order deposit fail: order cancelled server-side → checkout.
    // Order-detail deposit resume fail: stay on order (PE: Back to order).
    if (isDepositOrder && !isOrderDetailSource) {
      // Deposit fail from checkout: order cancelled server-side, navigate back to checkout
      return (
        <View style={{ flex: 1 }}>
          <PaymentRetryView
            errorTitle={t('orders.deposit.failedTitle', 'Deposit not received')}
            errorReason={t(
              'orders.deposit.failedBody',
              "No MoMo approval received. Your order wasn't placed. Return to checkout to try again with the same or different number."
            )}
            tips={[
              {
                icon: 'wallet-outline',
                title: t('checkout.payment.checkBalance', 'Check your MoMo balance'),
                description: t('checkout.payment.checkBalanceDesc', 'Top up your MoMo wallet before trying again.'),
              },
              {
                icon: 'phone-check-outline',
                title: t('checkout.payment.confirmPhone', 'Confirm your phone number'),
                description: t('checkout.payment.confirmPhoneDesc', 'Make sure {{phone}} matches the number linked to your MoMo wallet.', { phone: masked }),
              },
            ]}
            onRetry={onBackToCheckout}
            retrying={false}
            showOrderReservedBanner={false}
            retryLabel={t('orders.deposit.backToCheckout', 'Back to checkout')}
            // No onEditPhone or onChangeMethod for deposits - must re-place order
          />
        </View>
      );
    }
    
    const errorReason = error || retryError || (
      isDepositOrder
        ? t('deposit.paymentFailedBody', 'The deposit payment request did not succeed. You can try again or return to your order.')
        : t('orders.momoAwaiting.failedBody', 'The mobile money request did not succeed. You can try again or go back to your order.')
    );
    
    return (
      <View style={{ flex: 1 }}>
        <PaymentRetryView
          errorTitle={
            isDepositOrder
              ? t('deposit.paymentFailedTitle', 'Deposit payment failed')
              : t('orders.momoAwaiting.failedTitle', 'Payment failed')
          }
          errorReason={errorReason}
          tips={[
            {
              icon: 'wallet-outline',
              title: t('checkout.payment.checkBalance', 'Check your MoMo balance'),
              description: t('checkout.payment.checkBalanceDesc', 'Top up your MoMo wallet and try again.'),
            },
            {
              icon: 'phone-check-outline',
              title: t('checkout.payment.confirmPhone', 'Confirm your phone number'),
              description: t('checkout.payment.confirmPhoneDesc', 'Make sure {{phone}} matches the number linked to your MoMo wallet.', { phone: masked }),
            },
          ]}
          onRetry={() => void onRetry()}
          retrying={retrying}
          showOrderReservedBanner={!isOrderDetailSource}
          onEditPhone={isOrderDetailSource ? undefined : onEditPhone}
          retryLabel={
            isDepositOrder
              ? t('deposit.sendAgain', 'Send again')
              : source === 'pickup'
                ? t('business.pickup.momoSendAgain', 'Send again')
                : undefined
          }
          onSecondary={isOrderDetailSource ? leaveToOrder : undefined}
          secondaryLabel={
            isOrderDetailSource
              ? t('orders.momoAwaiting.back', 'Back to order')
              : undefined
          }
        />
        
        <AddPaymentPhoneDialog
          visible={editPhoneDialogVisible}
          saving={savingPhone}
          onDismiss={onDismissEditPhoneDialog}
          onSave={onSavePhone}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          alignItems: 'center',
        }}
      >
        {waiting ? <MobileMoneyConfirmIllustration /> : null}
        {phase === 'paid' ? (
          <MaterialCommunityIcons
            name="check-circle"
            size={72}
            color={colors.success.main}
            accessibilityLabel={t('orders.momoAwaiting.paidTitle', 'Payment confirmed')}
          />
        ) : null}
        {phase === 'timeout' ? (
          <MaterialCommunityIcons
            name="clock-outline"
            size={72}
            color={colors.warning.main}
            accessibilityLabel={t('orders.momoAwaiting.timeoutTitle', 'Still waiting')}
          />
        ) : null}

        <Text
          variant="headlineSmall"
          style={{
            marginTop: spacing.md,
            textAlign: 'center',
            fontWeight: '700',
            color:
              phase === 'paid'
                ? colors.success.main
                : phase === 'failed'
                  ? colors.error.main
                  : colors.text.primary,
          }}
        >
          {phase === 'paid'
            ? isDepositOrder
              ? t('deposit.paidTitle', 'Deposit confirmed')
              : t('orders.momoAwaiting.paidTitle', 'Payment confirmed')
            : phase === 'timeout'
              ? t('orders.momoAwaiting.timeoutTitle', 'Still waiting')
              : isDepositOrder
                ? t('deposit.awaitingTitle', 'Approve deposit payment')
                : t('orders.momoAwaiting.waitingTitle', 'Approve on your phone')}
        </Text>

        <Text
          variant="bodyLarge"
          style={{
            marginTop: spacing.sm,
            textAlign: 'center',
            color: colors.text.secondary,
            lineHeight: 24,
          }}
        >
          {phase === 'paid'
            ? isDepositOrder
              ? t(
                  'deposit.paidBody',
                  'Your deposit payment is confirmed. The store will prepare your order. You will pay the remaining {{amount}} when you receive your order.',
                  {
                    amount: formatCurrency(
                      remainingAfterDepositAmount,
                      currencyParam || orderData?.currency || 'XAF',
                      'en-US'
                    ),
                  }
                )
              : source === 'pickup'
                ? t(
                    'orders.momoAwaiting.paidBodyPickup',
                    'Your payment went through. You can collect your order at the store.'
                  )
                : t(
                    'orders.momoAwaiting.paidBodyWaitingForStore',
                    "Waiting for the store to accept your order. We'll notify you as soon as they confirm."
                  )
            : phase === 'timeout'
              ? t(
                  'orders.momoAwaiting.timeoutBody',
                  'We have not seen the payment yet. You can leave — we will update the order when it arrives. Keep your phone nearby if you still need to approve.'
                )
              : isDepositOrder
                ? t(
                    'deposit.awaitingBody',
                    'A deposit payment request of {{amount}} was sent to {{phone}}. Open the prompt on that phone and approve it with your PIN.',
                    {
                      phone: masked,
                      amount: formatCurrency(
                        depositAmountParam ?? orderData?.deposit_amount ?? 0,
                        currencyParam || orderData?.currency || 'XAF',
                        'en-US'
                      ),
                    }
                  )
                : t(
                    'orders.momoAwaiting.waitingBody',
                    'A payment request was sent to {{phone}}. Open the prompt on that phone and approve it with your PIN.',
                    { phone: masked }
                  )}
        </Text>

        {waiting ? (
          <View
            style={[
              styles.statusCard,
              {
                marginTop: spacing.lg,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                borderColor: colors.divider,
                padding: spacing.md,
                width: '100%',
              },
            ]}
          >
            <ActivityIndicator color={colors.primary.main} />
            <Text
              variant="bodyMedium"
              style={{
                marginTop: spacing.sm,
                textAlign: 'center',
                color: colors.text.secondary,
              }}
            >
              {t('orders.momoAwaiting.waitingHint', 'Waiting for payment to complete…')}
            </Text>
          </View>
        ) : null}

        {phase === 'paid' && source === 'checkout' ? (
          <View
            style={[
              styles.statusCard,
              {
                marginTop: spacing.lg,
                backgroundColor: colors.primaryTint,
                borderRadius: borderRadius.md,
                borderColor: colors.primary.main,
                borderWidth: 1,
                padding: spacing.md,
                width: '100%',
                gap: spacing.sm,
              },
            ]}
          >
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.text.secondary} />
              <Text variant="bodySmall" style={{ color: colors.text.secondary, flex: 1 }}>
                {t('orders.momoAwaiting.usuallyWithin', 'Usually within 15 min')}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.text.secondary} />
              <Text variant="bodySmall" style={{ color: colors.text.secondary, flex: 1 }}>
                {t('orders.momoAwaiting.refundIfNotAccepted', 'If not accepted, you get a refund')}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
          {phase === 'paid' ? (
            <>
              <Button mode="contained" onPress={onContinueAfterPaid}>
                {isDepositOrder
                  ? t('orders.deposit.continue', 'Continue')
                  : source === 'pickup'
                    ? t('orders.momoAwaiting.viewOrder', 'View order')
                    : t('orders.momoAwaiting.viewOrder', 'View order')}
              </Button>
              {/* Only show Track on map for delivery orders, not pickup */}
              {source === 'checkout' && fulfillment === 'delivery' && !isDepositOrder ? (
                <Button mode="outlined" icon="map-marker-outline" onPress={leaveToOrder}>
                  {t('orders.momoAwaiting.trackOnMap', 'Track on map')}
                </Button>
              ) : null}
            </>
          ) : null}
          {phase === 'timeout' && isDepositOrder && source !== 'order-detail' ? (
            <Button mode="contained" onPress={onBackToCheckout}>
              {t('orders.deposit.backToCheckout', 'Back to checkout')}
            </Button>
          ) : null}
          {phase !== 'paid' &&
          !(phase === 'timeout' && isDepositOrder && source !== 'order-detail') ? (
            <Button mode="text" onPress={leaveToOrder}>
              {t('orders.momoAwaiting.back', 'Back to order')}
            </Button>
          ) : null}
        </View>
      </ScrollView>

      <AddPaymentPhoneDialog
        visible={editPhoneDialogVisible}
        saving={savingPhone}
        onDismiss={onDismissEditPhoneDialog}
        onSave={onSavePhone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    alignItems: 'center',
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
