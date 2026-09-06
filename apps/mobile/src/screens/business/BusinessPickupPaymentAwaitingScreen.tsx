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
  BusinessRootStackParamList,
  BusinessPickupPaymentAwaitingParams,
} from '../../navigation/types';
import { agentApi } from '../../services/agentApi';
import { maskPhoneE164 } from '../../utils/maskPhoneE164';

export default function BusinessPickupPaymentAwaitingScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const route =
    useRoute<
      RouteProp<
        { BusinessPickupPaymentAwaiting: BusinessPickupPaymentAwaitingParams },
        'BusinessPickupPaymentAwaiting'
      >
    >();
  const { orderId, phoneE164, orderNumber, amount } = route.params;
  const { state, error, stop, restart } = useMobileMoneyPaymentPoll([orderId]);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const masked = useMemo(() => maskPhoneE164(phoneE164), [phoneE164]);

  const leaveToOrder = useCallback(() => {
    stop();
    navigation.replace('BusinessOrderDetail', { orderId });
  }, [navigation, orderId, stop]);

  const leaveToDashboard = useCallback(() => {
    stop();
    navigation.navigate('BusinessMainTabs', { screen: 'BusinessDashboard' });
  }, [navigation, stop]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('business.pickup.momoNavTitle', 'Waiting for payment'),
      headerBackTitle: t('common.back', 'Back'),
      headerBackVisible: false,
      gestureEnabled: false,
    });
  }, [navigation, t]);

  const onRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await agentApi.orders.initiatePayAtPickupPayment(orderId, phoneE164);
      restart();
    } catch (e: unknown) {
      setRetryError(
        e instanceof Error
          ? e.message
          : t('business.pickup.momoRetryError', 'Could not send another payment request.')
      );
    } finally {
      setRetrying(false);
    }
  };

  const phase = state.phase;
  const waiting = phase === 'waiting';

  if (phase === 'failed') {
    const errorReason =
      error ||
      retryError ||
      t(
        'business.pickup.momoFailedBody',
        'The mobile money request did not succeed. You can try again or go back.'
      );

    return (
      <PaymentRetryView
        errorTitle={t('business.pickup.momoFailedTitle', 'Payment not received')}
        errorReason={errorReason}
        tips={[
          {
            icon: 'wallet-outline',
            title: t('business.pickup.checkBalance', 'Ask client to check MoMo balance'),
            description: t(
              'business.pickup.checkBalanceDesc',
              'They may need to top up before approving.'
            ),
          },
          {
            icon: 'phone-check-outline',
            title: t('business.pickup.confirmPhone', 'Confirm the phone number'),
            description: t(
              'business.pickup.confirmPhoneDesc',
              'Must match their MoMo wallet: {{phone}}',
              { phone: masked }
            ),
          },
        ]}
        onRetry={() => void onRetry()}
        retrying={retrying}
        showOrderReservedBanner={false}
        retryLabel={t('business.pickup.momoSendAgain', 'Send again')}
        onSecondary={leaveToOrder}
        secondaryLabel={t('business.pickup.momoBackToOrder', 'Back to order')}
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
            accessibilityLabel={t('business.pickup.momoPaidTitle', 'Payment confirmed')}
          />
        ) : null}
        {phase === 'timeout' ? (
          <MaterialCommunityIcons
            name="clock-outline"
            size={72}
            color={colors.warning.main}
            accessibilityLabel={t('business.pickup.momoTimeoutTitle', 'Still waiting')}
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
                : phase === 'timeout'
                  ? colors.warning.main
                  : colors.text.primary,
          }}
        >
          {phase === 'paid'
            ? t(
                'business.pickup.momoPaidTitle',
                'Payment confirmed'
              )
            : phase === 'timeout'
              ? t('business.pickup.momoTimeoutTitle', 'Still waiting')
              : t('business.pickup.momoWaitingTitle', 'Waiting for client approval')}
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
            ? t(
                'business.pickup.momoPaidBody',
                'The client paid {{amount}}. You can hand over the order when they are ready.',
                { amount: amount || '' }
              )
            : phase === 'timeout'
              ? t(
                  'business.pickup.momoTimeoutBody',
                  "No payment yet. You can leave — we'll update the order when it arrives. Keep the client nearby if they still need to approve."
                )
              : t(
                  'business.pickup.momoWaitingBody',
                  'A MoMo request was sent to {{phone}}. Ask the client to approve it with their PIN.',
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
              {t('business.pickup.momoWaitingHint', 'Listening for payment…')}
            </Text>
            {orderNumber ? (
              <Text
                variant="bodySmall"
                style={{
                  marginTop: spacing.xs,
                  textAlign: 'center',
                  color: colors.text.disabled,
                }}
              >
                {t('business.pickup.momoOrderNumber', 'Order {{orderNumber}}', {
                  orderNumber,
                })}
                {amount ? ` • ${amount}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
          {phase === 'paid' ? (
            <>
              <Button mode="contained" onPress={leaveToDashboard}>
                {t('business.pickup.momoDashboard', 'Back to dashboard')}
              </Button>
              <Button mode="outlined" onPress={leaveToOrder}>
                {t('business.pickup.momoViewOrder', 'View order')}
              </Button>
            </>
          ) : null}
          {phase === 'timeout' ? (
            <>
              <Button mode="contained" loading={retrying} disabled={retrying} onPress={() => void onRetry()}>
                {t('business.pickup.momoSendAgain', 'Send again')}
              </Button>
              <Button mode="text" onPress={leaveToDashboard}>
                {t('business.pickup.momoDashboard', 'Back to dashboard')}
              </Button>
            </>
          ) : null}
          {waiting ? (
            <Button mode="text" onPress={leaveToOrder}>
              {t('business.pickup.momoBackToOrder', 'Back to order')}
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
});
