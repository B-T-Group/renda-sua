import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Button, Chip, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientProfileForPlaceOrder } from '../../hooks/useClientProfileForPlaceOrder';
import { useClientOrders } from '../../hooks/useClientOrders';
import { FirstOrderNextStepsPreview } from './FirstOrderNextStepsPreview';
import { OrderNextStepsCard } from './OrderNextStepsCard';
import { resolveOrderNextSteps } from './orderPlacedNextSteps';
import { isFirstOrderGuidanceForced } from '../../config/firstOrderDebug';
import { isClientFirstOrderCheckoutEligible } from '../../utils/firstOrderClientJourney';
import { trackFirstOrderClientPlaced } from '../../utils/firstOrderClientAnalytics';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useStore } from '../../stores/RootStore';
import { ContactNudgeBanner } from '../common/ContactNudgeBanner';
import type { OrderPlacedSuccessParams } from '../../navigation/types';

export type OrderPlacedSuccessAction = {
  label: string;
  onPress: () => void;
};

export type OrderPlacedSuccessViewProps = OrderPlacedSuccessParams & {
  /** Deposit MoMo just succeeded; remainder is due at delivery/pickup. */
  depositConfirmed?: boolean;
  remainingAmountLabel?: string;
  primaryAction: OrderPlacedSuccessAction;
  secondaryAction: OrderPlacedSuccessAction;
};

function paymentChipLabel(
  t: ReturnType<typeof useTranslation>['t'],
  params: {
    depositConfirmed?: boolean;
    cardAuthorized?: boolean;
    paymentCompleted?: boolean;
    paymentTiming: OrderPlacedSuccessParams['paymentTiming'];
    cookedFoodPayAfterConfirm?: boolean;
    payAfterCopyVariant?: 'cooked' | 'store';
  }
) {
  if (params.depositConfirmed) {
    return t('client.placeOrder.successScreen.chipDepositPaid', 'Deposit paid');
  }
  if (params.cardAuthorized) {
    return t('client.placeOrder.successScreen.chipCardAuthorized', 'Card authorized');
  }
  // Food MoMo: order is placed unpaid; payment request comes after kitchen confirm.
  if (params.cookedFoodPayAfterConfirm) {
    if (params.payAfterCopyVariant === 'store') {
      return t(
        'client.placeOrder.successScreen.chipStorePayAfterConfirm',
        'Pay after the store confirms'
      );
    }
    return t(
      'client.placeOrder.successScreen.chipCookedFoodPayAfterConfirm',
      'Pay after kitchen confirms'
    );
  }
  if (params.paymentCompleted) {
    return t('client.placeOrder.successScreen.chipPaid', 'Order confirmed and paid');
  }
  if (params.paymentTiming === 'pay_at_delivery') {
    return t('client.placeOrder.successScreen.chipPayAtDelivery', 'Pay at delivery');
  }
  if (params.paymentTiming === 'pay_at_pickup') {
    return t('client.placeOrder.successScreen.chipPayAtPickup', 'Pay at pickup');
  }
  return t('client.placeOrder.successScreen.chipPayNow', 'Payment confirmation required');
}

function SuccessNextSteps(props: OrderPlacedSuccessViewProps & { isStripeRail: boolean }) {
  const steps = resolveOrderNextSteps(props);
  if (!steps) return null;
  return <OrderNextStepsCard content={steps} />;
}

export const OrderPlacedSuccessView = observer(function OrderPlacedSuccessView(
  props: OrderPlacedSuccessViewProps
) {
  const {
    orderNumbers,
    paymentTiming,
    paymentCompleted,
    cardAuthorized,
    fulfillment,
    depositConfirmed,
    cookedFoodPayAfterConfirm,
    payAfterCopyVariant,
    primaryAction,
    secondaryAction,
  } = props;
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const primaryOrderLabel = orderNumbers.length === 1 ? orderNumbers[0] : orderNumbers.join(', ');
  const { user: meUser, loading: profileLoading, refetch: refetchProfile } = useClientProfileForPlaceOrder();
  const { isStripeRail, loading: stripeRailLoading } = useIsStripeRail();
  const { stats, loading: ordersLoading, error: ordersError } = useClientOrders(true);
  const placedTrackedRef = useRef(false);
  const fulfillmentPath =
    fulfillment === 'pickup' || fulfillment === 'shipping' ? fulfillment : 'delivery';
  const showFirstOrderPreview =
    !ordersLoading &&
    !ordersError &&
    (isFirstOrderGuidanceForced() ||
      isClientFirstOrderCheckoutEligible(stats.total, orderNumbers.length));
  const { nudge } = useStore();
  const [contactSnack, setContactSnack] = useState<string | null>(null);
  const isContentReady = !profileLoading && !stripeRailLoading;
  const chipIcon =
    depositConfirmed || (paymentCompleted && !cookedFoodPayAfterConfirm)
      ? 'check-circle-outline'
      : cardAuthorized
        ? 'credit-card-check-outline'
        : 'information-outline';

  useEffect(() => {
    if (!showFirstOrderPreview || placedTrackedRef.current) return;
    placedTrackedRef.current = true;
    trackFirstOrderClientPlaced({ fulfillment_method: fulfillmentPath });
  }, [fulfillmentPath, showFirstOrderPreview]);

  const paymentChip = paymentChipLabel(t, {
    depositConfirmed,
    cardAuthorized,
    paymentCompleted,
    paymentTiming,
    cookedFoodPayAfterConfirm,
    payAfterCopyVariant,
  });

  const missingEmail = !profileLoading && !(meUser?.email ?? '').trim();
  const missingPhone = !profileLoading && !(meUser?.phone_number ?? '').trim();
  const missingField: 'email' | 'phone' | null = missingEmail ? 'email' : missingPhone ? 'phone' : null;
  const showContactNudge = missingField !== null && !nudge.contactNudgeDismissed;

  if (!isContentReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.pageBackground,
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.md }}>
          {t('client.placeOrder.successScreen.preparing', 'Preparing your confirmation…')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg }}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <MaterialCommunityIcons name="check-circle" size={72} color={colors.success.main} />
          <Text
            variant="headlineSmall"
            style={{ color: colors.success.main, textAlign: 'center', marginTop: spacing.sm, fontWeight: '700' }}
          >
            {t('client.placeOrder.successScreen.title', 'Order placed successfully!')}
          </Text>
          <Text variant="titleMedium" style={{ color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs }}>
            {orderNumbers.length > 1
              ? t('client.placeOrder.successScreen.orderNumbers', 'Orders: {{numbers}}', {
                  numbers: primaryOrderLabel,
                })
              : t('client.placeOrder.successScreen.orderNumber', 'Order: {{number}}', {
                  number: primaryOrderLabel,
                })}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: spacing.xs,
              marginTop: spacing.md,
            }}
          >
            <Chip icon={chipIcon} accessibilityLabel={paymentChip}>
              {paymentChip}
            </Chip>
            <Chip
              icon="clipboard-text-outline"
              accessibilityLabel={t(
                'client.placeOrder.successScreen.trackHint',
                'Track progress in My orders'
              )}
            >
              {t('client.placeOrder.successScreen.trackHint', 'Track progress in My orders')}
            </Chip>
          </View>
        </View>

        {showFirstOrderPreview ? (
          <FirstOrderNextStepsPreview fulfillmentPath={fulfillmentPath} />
        ) : null}

        <SuccessNextSteps {...props} isStripeRail={isStripeRail} />

        {cookedFoodPayAfterConfirm && payAfterCopyVariant === 'store' ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginBottom: spacing.md }}
          >
            {t(
              'orders.payAfterConfirm.storeNoConfirm',
              'If the store doesn’t confirm within 60 minutes, your order is cancelled automatically and you are not charged.'
            )}
          </Text>
        ) : null}

        {showContactNudge && missingField ? (
          <View style={{ marginBottom: spacing.md }}>
            <ContactNudgeBanner
              missingField={missingField}
              onDismiss={() => void nudge.dismiss()}
              onSaved={() => {
                void refetchProfile();
                setContactSnack(
                  missingField === 'email'
                    ? t('client.placeOrder.successScreen.emailSuccess', 'Email saved.')
                    : t('nudge.contact.phoneSaved', 'Phone number saved.')
                );
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
          backgroundColor: colors.pageBackground,
          gap: spacing.xs,
        }}
      >
        <Button mode="contained" onPress={primaryAction.onPress} style={{ borderRadius: borderRadius.md }}>
          {primaryAction.label}
        </Button>
        <Button mode="text" onPress={secondaryAction.onPress}>
          {secondaryAction.label}
        </Button>
      </View>

      <Snackbar visible={!!contactSnack} onDismiss={() => setContactSnack(null)} duration={3000}>
        {contactSnack}
      </Snackbar>
    </View>
  );
});
