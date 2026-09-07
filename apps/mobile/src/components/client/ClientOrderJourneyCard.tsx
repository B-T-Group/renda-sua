import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { OrderJourneyIllustration } from '../illustrations/OrderJourneyIllustrations';
import { SendDeliveryPinButton } from './SendDeliveryPinButton';
import type { Order } from '../../types/agent';
import { isStorePickupOrder } from '../../utils/businessOrderListDisplay';
import { getClientOrderJourney, type JourneyTone } from '../../utils/clientOrderJourney';
import { clientShowDeliveryPin } from '../../utils/clientOrderActions';
import { PickupStoreLocator } from './PickupStoreLocator';

export interface ClientOrderJourneyCardProps {
  order: Order;
  variant: 'compact' | 'full';
  onPinSent?: () => void;
  onPinError?: (message: string) => void;
  showPinAction?: boolean;
}

function toneColor(
  tone: JourneyTone,
  colors: ReturnType<typeof useTheme>['colors']
): string {
  return colors[tone].main;
}

export function ClientOrderJourneyCard({
  order,
  variant,
  onPinSent,
  onPinError,
  showPinAction = true,
}: ClientOrderJourneyCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const journey = useMemo(() => getClientOrderJourney(order), [order]);
  const accent = toneColor(journey.tone, colors);
  const isPickup = isStorePickupOrder(order);
  const showPinButton =
    variant === 'full' &&
    showPinAction &&
    journey.emphasizePinCta &&
    clientShowDeliveryPin(order);
  const showPickupLocator =
    variant === 'full' &&
    isPickup &&
    order.current_status === 'ready_for_pickup';

  const title = t(journey.titleKey, {
    ...journey.interpolation,
    defaultValue: journey.titleDefault,
  });
  const now = t(journey.nowKey, {
    ...journey.interpolation,
    defaultValue: journey.nowDefault,
  });
  const next = journey.nextKey
    ? t(journey.nextKey, {
        ...journey.interpolation,
        defaultValue: journey.nextDefault ?? '',
      })
    : null;

  if (variant === 'compact') {
    return (
      <View
        style={[
          styles.compact,
          {
            borderColor: colors.divider,
            backgroundColor: colors.pageBackground,
            borderRadius: borderRadius.sm,
            borderLeftColor: accent,
            marginTop: spacing.sm,
            padding: spacing.sm,
          },
        ]}
      >
        <Text
          variant="labelMedium"
          style={{ color: accent, fontWeight: '700' }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.primary, marginTop: 2 }}
          numberOfLines={2}
        >
          {now}
        </Text>
        {next ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: 2 }}
            numberOfLines={2}
          >
            {next}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.full,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderLeftColor: accent,
          padding: spacing.md,
        },
      ]}
    >
      <OrderJourneyIllustration id={journey.illustrationId} size={104} />
      <Text
        variant="titleMedium"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          textAlign: 'center',
          marginTop: spacing.sm,
        }}
      >
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.primary, textAlign: 'center', marginTop: 6 }}
      >
        {now}
      </Text>
      {next ? (
        <Text
          variant="bodySmall"
          style={{
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          {next}
        </Text>
      ) : null}
      {showPickupLocator ? (
        <PickupStoreLocator
          address={order.business_location?.address}
          storeName={order.business_location?.name}
          contactName={order.business?.name}
          phone={order.business?.user?.phone_number}
        />
      ) : null}
      {journey.showPinHint && !showPinButton ? (
        <Text
          variant="labelSmall"
          style={{
            color: colors.warning.dark,
            textAlign: 'center',
            marginTop: spacing.sm,
          }}
        >
          {isPickup
            ? t(
                'client.orderJourney.pickupPinHint',
                'Send your pickup PIN from this app when you arrive.'
              )
            : t(
                'client.orderJourney.pinHint',
                'Have your delivery PIN ready in the app.'
              )}
        </Text>
      ) : null}
      {showPinButton ? (
        <View style={{ marginTop: spacing.md }}>
          <SendDeliveryPinButton
            orderId={order.id}
            pinAudience={isPickup ? 'business' : 'agent'}
            onSent={onPinSent}
            onError={onPinError}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  full: {
    borderWidth: 1,
    borderLeftWidth: 4,
    alignItems: 'stretch',
  },
});
