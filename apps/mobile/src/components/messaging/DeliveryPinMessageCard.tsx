import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { DeliveryPinStructuredContent } from '../../services/agentApi';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';

type Props = {
  content: DeliveryPinStructuredContent;
  variant?: 'delivery' | 'rentalStart';
};

export function DeliveryPinMessageCard({ content, variant = 'delivery' }: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, shadows } = useTheme();

  const isActive = content.status === 'active';
  const isRental = variant === 'rentalStart';
  const title = isRental
    ? t('rentals.messaging.startPin.title', 'Start PIN')
    : t('orders.messaging.deliveryPin.title', 'Delivery PIN');
  const a11y = isRental
    ? t('rentals.messaging.startPin.cardA11y', 'Rental start PIN message')
    : t('orders.messaging.deliveryPin.cardA11y', 'Delivery PIN message');

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: isActive ? colors.primary.main : colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={a11y}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="key-variant"
          size={18}
          color={isActive ? colors.primary.main : colors.text.secondary}
        />
        <Text style={[typography.subtitle2, { color: colors.text.primary, flex: 1 }]}>
          {title}
        </Text>
        {!isActive ? (
          <StatusPill
            label={
              content.status === 'superseded'
                ? t('orders.messaging.deliveryPin.superseded', 'Superseded')
                : t('orders.messaging.deliveryPin.revoked', 'No longer valid')
            }
            backgroundColor={colors.pageBackground}
            textColor={colors.text.secondary}
            borderColor={colors.divider}
            compact
          />
        ) : null}
      </View>

      {content.pin ? (
        <Text
          style={[
            typography.headlineSmall,
            styles.pin,
            { color: colors.text.primary },
          ]}
          accessibilityLabel={t(
            isRental
              ? 'rentals.messaging.startPin.pinA11y'
              : 'orders.messaging.deliveryPin.pinA11y',
            isRental ? 'Start PIN {{pin}}' : 'Delivery PIN {{pin}}',
            { pin: content.pin.split('').join(' ') }
          )}
        >
          {content.pin}
        </Text>
      ) : (
        <Text style={[typography.body2, { color: colors.text.secondary }]}>
          {isActive
            ? isRental
              ? t(
                  'rentals.messaging.startPin.maskedActive',
                  'Start PIN shared with {{business}}',
                  {
                    business:
                      content.sharedToDisplayName ??
                      t('common.business', 'business'),
                  }
                )
              : t(
                  'orders.messaging.deliveryPin.maskedActive',
                  'Delivery PIN shared with {{agent}}',
                  { agent: content.sharedToDisplayName ?? t('common.agent', 'agent') }
                )
            : isRental
              ? t('rentals.messaging.startPin.maskedInactive', 'Start PIN (hidden)')
              : t('orders.messaging.deliveryPin.maskedInactive', 'Delivery PIN (hidden)')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 12,
    maxWidth: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pin: {
    textAlign: 'center',
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
    paddingVertical: 8,
  },
});
