import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { MobileMoneyConfirmIllustration } from '../../components/illustrations/MobileMoneyConfirmIllustration';
import { PaymentRetryView } from '../../components/checkout/PaymentRetryView';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobileMoneyPaymentPoll } from '../../hooks/useMobileMoneyPaymentPoll';
import type {
  ClientRootStackParamList,
  MobileMoneyAwaitingPaymentParams,
} from '../../navigation/types';
import { agentApi } from '../../services/agentApi';
import { maskPhoneE164 } from '../../utils/maskPhoneE164';

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
  const { orderIds, phoneE164, source, orderNumbers, fulfillment } = route.params;
  const { state, error, stop, restart } = useMobileMoneyPaymentPoll(orderIds);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const masked = useMemo(() => maskPhoneE164(phoneE164), [phoneE164]);

  const leaveToOrder = useCallback(() => {
    stop();
    const firstId = orderIds[0];
    if (firstId) {
      navigation.replace('OrderDetail', { orderId: firstId });
      return;
    }
    navigation.navigate('ClientMainTabs', { screen: 'ClientOrders' });
  }, [navigation, orderIds, stop]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('orders.momoAwaiting.navTitle', 'Approve payment'),
      headerBackTitle: t('common.back', 'Back'),
    });
  }, [navigation, t]);

  const onRetry = async () => {
    if (!orderIds.length) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const phone = phoneE164.trim() || undefined;
      await Promise.all(
        orderIds.map((id) =>
          source === 'pickup'
            ? agentApi.orders.initiatePayAtPickupPayment(id, phone)
            : agentApi.orders.retryPayment(id)
        )
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

  // When phase is 'failed', use PaymentRetryView instead of inline UI
  if (phase === 'failed') {
    const errorReason = error || retryError || t('orders.momoAwaiting.failedBody', 'The mobile money request did not succeed. You can try again or go back to your order.');
    
    return (
      <PaymentRetryView
        errorTitle={t('orders.momoAwaiting.failedTitle', 'Payment failed')}
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
        showOrderReservedBanner={true}
        onEditPhone={undefined} // Can be added later if needed
        retryLabel={source === 'pickup' ? t('business.pickup.momoSendAgain', 'Send again') : undefined}
        // onChangeMethod NOT passed - payment rail is locked by preflight
      />
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
            ? t('orders.momoAwaiting.paidTitle', 'Payment confirmed')
            : phase === 'timeout'
              ? t('orders.momoAwaiting.timeoutTitle', 'Still waiting')
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
            ? source === 'pickup'
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
                {source === 'pickup'
                  ? t('orders.momoAwaiting.viewOrder', 'View order')
                  : t('orders.momoAwaiting.viewOrder', 'View order')}
              </Button>
              {/* Only show Track on map for delivery orders, not pickup */}
              {source === 'checkout' && fulfillment === 'delivery' ? (
                <Button mode="outlined" icon="map-marker-outline" onPress={leaveToOrder}>
                  {t('orders.momoAwaiting.trackOnMap', 'Track on map')}
                </Button>
              ) : null}
            </>
          ) : null}
          {phase !== 'paid' ? (
            <Button mode="text" onPress={leaveToOrder}>
              {t('orders.momoAwaiting.back', 'Back to order')}
            </Button>
          ) : null}
        </View>
      </ScrollView>
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
