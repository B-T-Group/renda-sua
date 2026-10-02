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
import { useClaimPaymentPoll } from '../../hooks/useClaimPaymentPoll';
import type { ClaimAwaitingPaymentParams } from '../../navigation/types';
import { agentApi } from '../../services/agentApi';
import { claimHoldTransactionId } from '../../utils/claimAwaitingNav';
import { maskPhoneE164 } from '../../utils/maskPhoneE164';

type ClaimAwaitingParamList = {
  ClaimAwaitingPayment: ClaimAwaitingPaymentParams;
  MainTabs: {
    screen: 'Orders';
    params: { screen: 'OrderDetail'; params: { orderId: string } };
  };
};

type Nav = NativeStackNavigationProp<ClaimAwaitingParamList, 'ClaimAwaitingPayment'>;
type Route = RouteProp<ClaimAwaitingParamList, 'ClaimAwaitingPayment'>;

export default function ClaimAwaitingPaymentScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { orderId, phoneE164 } = route.params;
  const [transactionId, setTransactionId] = useState(route.params.transactionId);
  const { state, error, stop, restart } = useClaimPaymentPoll(transactionId);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const masked = useMemo(() => maskPhoneE164(phoneE164), [phoneE164]);
  const phase = state.phase;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('orders.momoAwaiting.navTitle', 'Approve payment'),
      headerBackTitle: t('common.back', 'Back'),
    });
  }, [navigation, t]);

  const openOrder = useCallback(() => {
    stop();
    navigation.navigate('MainTabs', {
      screen: 'Orders',
      params: { screen: 'OrderDetail', params: { orderId } },
    });
  }, [navigation, orderId, stop]);

  const onRetry = useCallback(async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const nextId = await resendClaimPayment(orderId, phoneE164);
      setTransactionId(nextId);
      restart();
    } catch (e: unknown) {
      setRetryError(retryMessage(e, t));
    } finally {
      setRetrying(false);
    }
  }, [orderId, phoneE164, restart, t]);

  if (phase === 'taken') {
    return (
      <ClaimOrderTaken
        onBack={() => {
          stop();
          navigation.goBack();
        }}
      />
    );
  }

  if (phase === 'failed') {
    return (
      <ClaimPaymentFailed
        masked={masked}
        reason={retryError || error}
        retrying={retrying}
        onRetry={() => void onRetry()}
        onBack={openOrder}
      />
    );
  }

  return (
    <ClaimPaymentWaiting
      phase={phase}
      masked={masked}
      paddingBottom={insets.bottom + spacing.xl}
      onOpenOrder={openOrder}
      onBack={() => {
        stop();
        navigation.goBack();
      }}
    />
  );
}

function ClaimOrderTaken(props: { onBack: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
      <Text variant="headlineSmall" style={{ textAlign: 'center', fontWeight: '700', color: colors.warning.main }}>
        {t('orders.momoAwaiting.takenTitle', 'Order no longer available')}
      </Text>
      <Text variant="bodyLarge" style={{ marginTop: spacing.sm, textAlign: 'center', color: colors.text.secondary, lineHeight: 24 }}>
        {t(
          'orders.momoAwaiting.takenBody',
          'This order is no longer available. The payment is available in your Rendasua wallet, so you can claim a different order.'
        )}
      </Text>
      <Button mode="contained" style={{ marginTop: spacing.xl }} onPress={props.onBack}>
        {t('orders.momoAwaiting.back', 'Back to order')}
      </Button>
    </View>
  );
}

function ClaimPaymentFailed(props: {
  masked: string;
  reason: string | null;
  retrying: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PaymentRetryView
      errorTitle={t('orders.momoAwaiting.failedTitle', 'Payment failed')}
      errorReason={
        props.reason ||
        t(
          'orders.momoAwaiting.failedBody',
          'The mobile money request did not succeed. You can try again or go back to your order.'
        )
      }
      tips={claimRetryTips(t, props.masked)}
      onRetry={props.onRetry}
      retrying={props.retrying}
      showOrderReservedBanner={false}
      onSecondary={props.onBack}
      secondaryLabel={t('orders.momoAwaiting.back', 'Back to order')}
    />
  );
}

function ClaimPaymentWaiting(props: {
  phase: 'waiting' | 'paid' | 'timeout';
  masked: string;
  paddingBottom: number;
  onOpenOrder: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const waiting = props.phase === 'waiting';
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: props.paddingBottom,
          alignItems: 'center',
        }}
      >
        {waiting ? <MobileMoneyConfirmIllustration /> : null}
        <ClaimPhaseIcon phase={props.phase} />
        <Text variant="headlineSmall" style={titleStyle(colors, props.phase, spacing.md)}>
          {claimPhaseTitle(t, props.phase)}
        </Text>
        <Text variant="bodyLarge" style={bodyStyle(colors, spacing.sm)}>
          {claimPhaseBody(t, props.phase, props.masked)}
        </Text>
        {waiting ? <ClaimWaitingHint /> : null}
        <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
          {props.phase === 'paid' ? (
            <Button mode="contained" onPress={props.onOpenOrder}>
              {t('orders.momoAwaiting.viewOrder', 'View order')}
            </Button>
          ) : (
            <Button mode="text" onPress={props.onBack}>
              {t('orders.momoAwaiting.back', 'Back to order')}
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ClaimWaitingHint() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.hint,
        {
          marginTop: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderColor: colors.divider,
          padding: spacing.md,
        },
      ]}
    >
      <ActivityIndicator color={colors.primary.main} />
      <Text variant="bodyMedium" style={{ marginTop: spacing.sm, textAlign: 'center', color: colors.text.secondary }}>
        {t('orders.momoAwaiting.waitingHint', 'Waiting for payment to complete…')}
      </Text>
    </View>
  );
}

function ClaimPhaseIcon({ phase }: { phase: 'waiting' | 'paid' | 'timeout' }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (phase === 'paid') {
    return (
      <MaterialCommunityIcons
        name="check-circle"
        size={72}
        color={colors.success.main}
        accessibilityLabel={t('orders.momoAwaiting.paidTitle', 'Payment confirmed')}
      />
    );
  }
  if (phase === 'timeout') {
    return (
      <MaterialCommunityIcons
        name="clock-outline"
        size={72}
        color={colors.warning.main}
        accessibilityLabel={t('orders.momoAwaiting.timeoutTitle', 'Still waiting')}
      />
    );
  }
  return null;
}

function claimPhaseTitle(t: (key: string, fallback: string) => string, phase: string): string {
  if (phase === 'paid') return t('orders.momoAwaiting.paidTitle', 'Payment confirmed');
  if (phase === 'timeout') return t('orders.momoAwaiting.timeoutTitle', 'Still waiting');
  return t('orders.momoAwaiting.waitingTitle', 'Approve on your phone');
}

function claimPhaseBody(
  t: (key: string, fallback: string, options?: Record<string, string>) => string,
  phase: string,
  phone: string
): string {
  if (phase === 'paid') {
    return t('orders.momoAwaiting.paidBodyClaim', 'The hold is approved. This order is now assigned to you.');
  }
  if (phase === 'timeout') {
    return t(
      'orders.momoAwaiting.timeoutBody',
      'We have not seen the payment yet. You can leave — we will update the order when it arrives. Keep your phone nearby if you still need to approve.'
    );
  }
  return t(
    'orders.momoAwaiting.waitingBody',
    'A payment request was sent to {{phone}}. Open the prompt on that phone and approve it with your PIN.',
    { phone }
  );
}

function claimRetryTips(
  t: (key: string, fallback: string, options?: Record<string, string>) => string,
  phone: string
) {
  return [
    {
      icon: 'wallet-outline',
      title: t('checkout.payment.checkBalance', 'Check your MoMo balance'),
      description: t('checkout.payment.checkBalanceDesc', 'Top up your MoMo wallet and try again.'),
    },
    {
      icon: 'phone-check-outline',
      title: t('checkout.payment.confirmPhone', 'Confirm your phone number'),
      description: t(
        'checkout.payment.confirmPhoneDesc',
        'Make sure {{phone}} matches the number linked to your MoMo wallet.',
        { phone }
      ),
    },
  ];
}

async function resendClaimPayment(orderId: string, phoneE164: string): Promise<string> {
  const res = await agentApi.orders.claimOrderWithTopup(orderId, phoneE164);
  return claimHoldTransactionId(res);
}

function retryMessage(error: unknown, t: (key: string, fallback: string) => string): string {
  if (error instanceof Error && error.message) return error.message;
  return t('orders.momoAwaiting.retryError', 'Could not send another payment request.');
}

function titleStyle(
  colors: { success: { main: string }; text: { primary: string } },
  phase: string,
  marginTop: number
) {
  return {
    marginTop,
    textAlign: 'center' as const,
    fontWeight: '700' as const,
    color: phase === 'paid' ? colors.success.main : colors.text.primary,
  };
}

function bodyStyle(colors: { text: { secondary: string } }, marginTop: number) {
  return {
    marginTop,
    textAlign: 'center' as const,
    color: colors.text.secondary,
    lineHeight: 24,
  };
}

const styles = StyleSheet.create({
  hint: { alignItems: 'center', borderWidth: 1, width: '100%' },
});
