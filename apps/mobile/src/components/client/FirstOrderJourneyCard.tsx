import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { OrderJourneyIllustration } from '../illustrations/OrderJourneyIllustrations';
import {
  openAddressInMaps,
  type AddressFields,
} from '../orders/shared/AddressCard';
import type {
  ClientFirstOrderJourneyView,
  ClientFirstOrderStep,
} from '../../utils/firstOrderClientJourney';

export interface FirstOrderJourneyCardProps {
  journey: ClientFirstOrderJourneyView;
  /** Store pickup address shown on the ready-for-pickup step. */
  storeAddress?: AddressFields | null;
  storeName?: string | null;
}

function formatStoreAddress(address: AddressFields): string {
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
}

function StoreAddressLink({
  address,
  storeName,
}: {
  address: AddressFields;
  storeName?: string | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const formatted = formatStoreAddress(address);
  if (!formatted) return null;

  return (
    <Pressable
      onPress={() => openAddressInMaps(address)}
      accessibilityRole="link"
      accessibilityLabel={t(
        'client.firstOrder.openStoreInMaps',
        'Open store address in Maps'
      )}
      style={({ pressed }) => [
        styles.addressLink,
        {
          borderColor: colors.primary.main + '44',
          backgroundColor: pressed
            ? colors.primary.main + '18'
            : colors.background.paper,
          borderRadius: borderRadius.sm,
          padding: spacing.sm,
          gap: spacing.xxs,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.addressHeader, { gap: spacing.xxs }]}>
        <MaterialCommunityIcons
          name="map-marker"
          size={18}
          color={colors.primary.main}
        />
        <Text
          variant="labelMedium"
          style={{ color: colors.primary.main, fontWeight: '700', flex: 1, minWidth: 0 }}
        >
          {storeName?.trim()
            ? storeName
            : t('client.firstOrder.storeAddressLabel', 'Store address')}
        </Text>
        <MaterialCommunityIcons
          name="open-in-new"
          size={16}
          color={colors.primary.main}
        />
      </View>
      <Text variant="bodySmall" style={{ color: colors.text.primary }}>
        {formatted}
      </Text>
      <Text variant="labelSmall" style={{ color: colors.primary.main }}>
        {t('client.firstOrder.openInMaps', 'Open in Maps')}
      </Text>
    </Pressable>
  );
}

function StepRow({
  step,
  stepNumber,
  storeAddress,
  storeName,
}: {
  step: ClientFirstOrderStep;
  stepNumber: number;
  storeAddress?: AddressFields | null;
  storeName?: string | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const isCurrent = step.state === 'current';
  const isDone = step.state === 'done';
  const showStoreAddress =
    isCurrent && step.id === 'ready_for_pickup' && !!storeAddress;

  if (!isCurrent && step.state === 'upcoming') {
    return (
      <View style={[styles.stepRow, { gap: spacing.sm, opacity: 0.55 }]}>
        <View
          style={[
            styles.stepBadge,
            {
              borderColor: colors.divider,
              backgroundColor: colors.background.paper,
            },
          ]}
        >
          <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
            {stepNumber}
          </Text>
        </View>
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.secondary, flex: 1, minWidth: 0 }}
          numberOfLines={2}
        >
          {t(step.titleKey, step.titleDefault)}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.stepBlock,
        {
          borderColor: isCurrent ? colors.primary.main + '55' : colors.divider,
          backgroundColor: isCurrent
            ? colors.primaryTint ?? colors.primary.main + '12'
            : colors.background.paper,
          borderRadius: borderRadius.md,
          padding: spacing.sm,
          gap: spacing.xs,
        },
      ]}
    >
      <View style={[styles.stepRow, { gap: spacing.sm }]}>
        <View
          style={[
            styles.stepBadge,
            {
              borderColor: isDone ? colors.success.main : colors.primary.main,
              backgroundColor: isDone
                ? colors.success.main + '22'
                : colors.primaryTint ?? colors.primary.main + '22',
            },
          ]}
        >
          {isDone ? (
            <MaterialCommunityIcons name="check" size={16} color={colors.success.main} />
          ) : (
            <Text
              variant="labelMedium"
              style={{ color: colors.primary.main, fontWeight: '700' }}
            >
              {stepNumber}
            </Text>
          )}
        </View>
        <Text
          variant="titleSmall"
          style={{
            color: colors.text.primary,
            fontWeight: '700',
            flex: 1,
            minWidth: 0,
          }}
        >
          {t(step.titleKey, step.titleDefault)}
        </Text>
      </View>
      {isCurrent ? (
        <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
          {t(step.whatHappensKey, step.whatHappensDefault)}
        </Text>
      ) : null}
      {showStoreAddress && storeAddress ? (
        <StoreAddressLink address={storeAddress} storeName={storeName} />
      ) : null}
    </View>
  );
}

export function FirstOrderJourneyCard({
  journey,
  storeAddress,
  storeName,
}: FirstOrderJourneyCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const currentStep = useMemo(
    () => journey.steps.find((step) => step.state === 'current') ?? journey.steps[0],
    [journey.steps]
  );
  const isSuccess = journey.isSuccess;
  const headerTitle = isSuccess
    ? journey.fulfillmentPath === 'pickup'
      ? t('client.firstOrder.successTitlePickup', 'First order picked up!')
      : journey.fulfillmentPath === 'shipping'
        ? t('client.firstOrder.successTitleShipping', 'First order received!')
        : t('client.firstOrder.successTitle', 'First order delivered!')
    : t('client.firstOrder.title', 'Your first order');
  const headerBody = isSuccess
    ? t(
        'client.firstOrder.successBody',
        "You're all set — future orders will show your usual order tracking."
      )
    : t(
        'client.firstOrder.subtitle',
        "Here's exactly what happens — one step at a time."
      );

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: isSuccess ? colors.success.main + '55' : colors.info.main + '55',
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.header}>
        <OrderJourneyIllustration
          id={currentStep?.illustrationId ?? 'received'}
          size={72}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {headerTitle}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {headerBody}
          </Text>
        </View>
      </View>
      {!isSuccess ? (
        <View style={{ gap: spacing.sm }}>
          {journey.steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              stepNumber={index + 1}
              storeAddress={storeAddress}
              storeName={storeName}
            />
          ))}
        </View>
      ) : null}
      {journey.pinExplainerKey && !isSuccess ? (
        <Text variant="bodySmall" style={{ color: colors.warning.dark }}>
          {t(journey.pinExplainerKey, journey.pinExplainerDefault ?? '')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBlock: {
    borderWidth: 1,
  },
  addressLink: {
    borderWidth: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
