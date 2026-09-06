import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, Card, Chip, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientProfileForPlaceOrder } from '../../hooks/useClientProfileForPlaceOrder';
import { useClientOrders } from '../../hooks/useClientOrders';
import { FirstOrderNextStepsPreview } from '../../components/client/FirstOrderNextStepsPreview';
import { isFirstOrderGuidanceForced } from '../../config/firstOrderDebug';
import { isClientFirstOrderCheckoutEligible } from '../../utils/firstOrderClientJourney';
import { trackFirstOrderClientPlaced } from '../../utils/firstOrderClientAnalytics';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useStore } from '../../stores/RootStore';
import { ContactNudgeBanner } from '../../components/common/ContactNudgeBanner';
import type { ClientRootStackParamList, OrderPlacedSuccessParams } from '../../navigation/types';

function PayNowNextSteps() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <Card style={{ marginBottom: spacing.md, backgroundColor: colors.primary.dark, borderRadius: borderRadius.md }}>
      <Card.Content style={{ paddingVertical: spacing.md }}>
        <Text variant="titleMedium" style={{ color: colors.primary.contrast, marginBottom: spacing.sm }}>
          {t('client.placeOrder.successScreen.payNowTitle', 'Payment confirmation required')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.primary.contrast, marginBottom: spacing.sm, lineHeight: 22 }}>
          {t(
            'client.placeOrder.successScreen.payNowBody',
            'A payment request has been sent to your mobile phone. Please confirm the payment to complete your order.'
          )}
        </Text>
        <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 20 }}>
          {t(
            'client.placeOrder.successScreen.payNowDeadline',
            'Your order will be transmitted to the merchant within 24 hours once payment is confirmed.'
          )}
        </Text>
      </Card.Content>
    </Card>
  );
}

function PaidNextSteps() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <Card
      mode="outlined"
      style={{
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.success.main,
        backgroundColor: colors.success.main + '14',
      }}
    >
      <Card.Content style={{ paddingVertical: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <MaterialCommunityIcons name="check-circle" size={24} color={colors.success.main} />
          <Text
            variant="titleMedium"
            style={{ color: colors.success.dark, fontWeight: '700', flex: 1, minWidth: 0 }}
          >
            {t('client.placeOrder.successScreen.paidTitle', 'Order confirmed and paid')}
          </Text>
        </View>
        <Text variant="bodyMedium" style={{ color: colors.text.primary, lineHeight: 22 }}>
          {t(
            'client.placeOrder.successScreen.paidBody',
            'Your payment was completed successfully. No further action is required.'
          )}
        </Text>
      </Card.Content>
    </Card>
  );
}

function CardAuthorizedNextSteps({ isPickup }: { isPickup: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const body = isPickup
    ? t(
        'client.placeOrder.successScreen.cardAuthorizedBodyPickup',
        'Your card has been authorized. You will only be charged when you collect your order at the store.'
      )
    : t(
        'client.placeOrder.successScreen.cardAuthorizedBody',
        'Your card has been authorized. You will only be charged when the delivery agent picks up your order from the business.'
      );
  return (
    <Card
      mode="outlined"
      style={{
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.info.main + '55',
        backgroundColor: colors.info.main + '12',
      }}
    >
      <Card.Content style={{ paddingVertical: spacing.md }}>
        <Text variant="titleMedium" style={{ color: colors.info.dark, marginBottom: spacing.sm }}>
          {t('client.placeOrder.successScreen.cardAuthorizedTitle', 'Card authorized')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.info.dark, lineHeight: 22 }}>
          {body}
        </Text>
      </Card.Content>
    </Card>
  );
}

function StripeNextSteps() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <Card
      mode="outlined"
      style={{
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.info.main + '55',
        backgroundColor: colors.info.main + '12',
      }}
    >
      <Card.Content style={{ paddingVertical: spacing.md }}>
        <Text variant="titleMedium" style={{ color: colors.info.dark, marginBottom: spacing.sm }}>
          {t('client.placeOrder.successScreen.cardPaymentTitle', 'Card payment')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.info.dark, lineHeight: 22 }}>
          {t(
            'client.placeOrder.successScreen.cardPaymentBody',
            'You can complete any remaining payment step securely by card from your order details.'
          )}
        </Text>
      </Card.Content>
    </Card>
  );
}

function PayAtDeliveryNextSteps() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <Card
      mode="outlined"
      style={{
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.info.main + '55',
        backgroundColor: colors.info.main + '12',
      }}
    >
      <Card.Content style={{ paddingVertical: spacing.md }}>
        <Text variant="titleMedium" style={{ color: colors.info.dark, marginBottom: spacing.sm }}>
          {t('client.placeOrder.successScreen.payAtDeliveryTitle', 'Payment at delivery')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.info.dark, lineHeight: 22 }}>
          {t(
            'client.placeOrder.successScreen.payAtDeliveryBody',
            'You chose pay at delivery. When the agent arrives, they will send a mobile payment request. Approve it on your phone.'
          )}
        </Text>
      </Card.Content>
    </Card>
  );
}

function PayAtPickupNextSteps() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <Card
      mode="outlined"
      style={{
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.info.main + '55',
        backgroundColor: colors.info.main + '12',
      }}
    >
      <Card.Content style={{ paddingVertical: spacing.md }}>
        <Text variant="titleMedium" style={{ color: colors.info.dark, marginBottom: spacing.sm }}>
          {t('client.placeOrder.successScreen.payAtPickupTitle', 'Pay when you pick up')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.info.dark, lineHeight: 22 }}>
          {t(
            'client.placeOrder.successScreen.payAtPickupBody',
            'Pay at the store when you pick up. When your order is ready, tap Pay in the app and approve the request on your phone. The store will see the payment, then you can collect your order.'
          )}
        </Text>
      </Card.Content>
    </Card>
  );
}

export default observer(function OrderPlacedSuccessScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<{ OrderPlacedSuccess: OrderPlacedSuccessParams }, 'OrderPlacedSuccess'>>();
  const { orderNumbers, paymentTiming, paymentCompleted, cardAuthorized, fulfillment } =
    route.params;
  const isPickup = fulfillment === 'pickup' || paymentTiming === 'pay_at_pickup';
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

  useEffect(() => {
    if (!showFirstOrderPreview || placedTrackedRef.current) return;
    placedTrackedRef.current = true;
    trackFirstOrderClientPlaced({ fulfillment_method: fulfillmentPath });
  }, [fulfillmentPath, showFirstOrderPreview]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);

  const goOrders = () => navigation.navigate('ClientMainTabs', { screen: 'ClientOrders' });
  const goDashboard = () => navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' });

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
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.lg,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <MaterialCommunityIcons name="check-circle" size={72} color={colors.success.main} />
          <Text variant="headlineSmall" style={{ color: colors.success.main, textAlign: 'center', marginTop: spacing.sm, fontWeight: '700' }}>
            {t('client.placeOrder.successScreen.title', 'Order placed successfully!')}
          </Text>
          <Text variant="titleMedium" style={{ color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs }}>
            {orderNumbers.length > 1
              ? t('client.placeOrder.successScreen.orderNumbers', 'Orders: {{numbers}}', { numbers: primaryOrderLabel })
              : t('client.placeOrder.successScreen.orderNumber', 'Order: {{number}}', { number: primaryOrderLabel })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md }}>
            <Chip icon={cardAuthorized ? 'credit-card-check-outline' : paymentCompleted ? 'check-circle-outline' : 'information-outline'}>
              {cardAuthorized
                ? t('client.placeOrder.successScreen.chipCardAuthorized', 'Card authorized')
                : paymentCompleted
                  ? t('client.placeOrder.successScreen.chipPaid', 'Order confirmed and paid')
                  : paymentTiming === 'pay_at_delivery'
                    ? t('client.placeOrder.successScreen.chipPayAtDelivery', 'Pay at delivery')
                    : paymentTiming === 'pay_at_pickup'
                      ? t('client.placeOrder.successScreen.chipPayAtPickup', 'Pay at pickup')
                      : t('client.placeOrder.successScreen.chipPayNow', 'Payment confirmation required')}
            </Chip>
            <Chip icon="clipboard-text-outline">
              {t('client.placeOrder.successScreen.trackHint', 'Track progress in My orders')}
            </Chip>
          </View>
        </View>

        {showFirstOrderPreview ? (
          <FirstOrderNextStepsPreview fulfillmentPath={fulfillmentPath} />
        ) : null}

        {paymentCompleted ? <PaidNextSteps /> : null}
        {cardAuthorized ? <CardAuthorizedNextSteps isPickup={isPickup} /> : null}
        {!paymentCompleted && !cardAuthorized && isStripeRail ? <StripeNextSteps /> : null}
        {!paymentCompleted && !cardAuthorized && !isStripeRail && paymentTiming === 'pay_now' ? (
          <PayNowNextSteps />
        ) : null}
        {!paymentCompleted && !cardAuthorized && !isStripeRail && paymentTiming === 'pay_at_delivery' ? (
          <PayAtDeliveryNextSteps />
        ) : null}
        {!paymentCompleted && !cardAuthorized && !isStripeRail && paymentTiming === 'pay_at_pickup' ? (
          <PayAtPickupNextSteps />
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
        <Button mode="contained" onPress={goDashboard} style={{ borderRadius: borderRadius.md }}>
          {t('client.placeOrder.successScreen.returnToDashboard', 'Return to dashboard')}
        </Button>
        <Button mode="text" onPress={goOrders}>
          {t('client.placeOrder.successScreen.viewOrders', 'My orders')}
        </Button>
      </View>

      <Snackbar visible={!!contactSnack} onDismiss={() => setContactSnack(null)} duration={3000}>
        {contactSnack}
      </Snackbar>
    </View>
  );
});
