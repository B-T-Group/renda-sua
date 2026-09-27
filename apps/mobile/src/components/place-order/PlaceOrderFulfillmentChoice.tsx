import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export type OrderFulfillment = 'delivery' | 'pickup' | 'shipping';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Translate = ReturnType<typeof useTranslation>['t'];

export interface FulfillmentPickupLocation {
  name?: string;
  address?: string;
}

interface PlaceOrderFulfillmentChoiceProps {
  value: OrderFulfillment;
  onChange: (value: OrderFulfillment) => void;
  deliveryDisabled?: boolean;
  deliveryDisabledReason?: string;
  pickupAvailable?: boolean;
  shippingAvailable?: boolean;
  shippingDisabled?: boolean;
  shippingDisabledReason?: string;
  pickupLocations?: FulfillmentPickupLocation[];
  deliveryPriceLabel?: string;
  deliveryPriceLoading?: boolean;
  deliveryPriceHint?: string;
  /** Compact segmented control for sticky checkout bars. */
  compact?: boolean;
}

interface SegmentOption {
  key: OrderFulfillment;
  label: string;
  icon: IconName;
  disabled: boolean;
}

function buildSegments(
  t: Translate,
  args: {
    deliveryDisabled: boolean;
    pickupAvailable: boolean;
    shippingAvailable: boolean;
    shippingDisabled: boolean;
  }
): SegmentOption[] {
  const options: SegmentOption[] = [];
  if (args.pickupAvailable) {
    options.push({
      key: 'pickup',
      label: t('client.placeOrder.pickup', 'Pickup'),
      icon: 'store-marker-outline',
      disabled: false,
    });
  }
  options.push({
    key: 'delivery',
    label: t('client.placeOrder.delivery', 'Delivery'),
    icon: 'truck-delivery-outline',
    disabled: args.deliveryDisabled,
  });
  if (args.shippingAvailable || args.shippingDisabled) {
    options.push({
      key: 'shipping',
      label: t('client.placeOrder.shipping', 'Shipping'),
      icon: 'package-variant-closed',
      disabled: args.shippingDisabled,
    });
  }
  return options;
}

function pickupSummary(locations: FulfillmentPickupLocation[]): string | null {
  const lines = locations
    .map((loc) => [loc.name, loc.address].filter(Boolean).join(' · '))
    .filter((line) => line.length > 0);
  return lines[0] ?? null;
}

function ContextLine({
  icon,
  children,
  loading,
}: {
  icon: IconName;
  children: ReactNode;
  loading?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={[styles.contextRow, { gap: spacing.xs }]}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.text.secondary} />
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary.main} />
      ) : (
        <Text
          numberOfLines={2}
          style={[typography.caption, { color: colors.text.secondary, flex: 1 }]}
        >
          {children}
        </Text>
      )}
    </View>
  );
}

export function PlaceOrderFulfillmentChoice({
  value,
  onChange,
  deliveryDisabled = false,
  deliveryDisabledReason,
  pickupAvailable = true,
  shippingAvailable = false,
  shippingDisabled = false,
  shippingDisabledReason,
  pickupLocations = [],
  deliveryPriceLabel,
  deliveryPriceLoading = false,
  deliveryPriceHint,
  compact = true,
}: PlaceOrderFulfillmentChoiceProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const segments = buildSegments(t, {
    deliveryDisabled,
    pickupAvailable,
    shippingAvailable,
    shippingDisabled,
  });

  const helper = deliveryDisabled
    ? deliveryDisabledReason ??
      t('client.placeOrder.deliveryUnavailable', 'Delivery is currently unavailable.')
    : shippingDisabled
      ? shippingDisabledReason ??
        t(
          'client.placeOrder.shippingUnavailableMixed',
          'Shipping is only available when every item in your cart can be shipped.'
        )
      : null;

  const storeLine = pickupSummary(pickupLocations);
  const showPickupContext = value === 'pickup' && !!storeLine;
  const showDeliveryContext =
    value === 'delivery' &&
    !deliveryDisabled &&
    (deliveryPriceLoading || !!deliveryPriceLabel || !!deliveryPriceHint);

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ gap: compact ? spacing.xs : spacing.sm }}
    >
      {!compact ? (
        <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
          {t('client.placeOrder.fulfillmentQuestion', 'How do you want it?')}
        </Text>
      ) : null}

      <View
        style={[
          styles.segmentTrack,
          {
            backgroundColor: colors.pageBackground,
            borderRadius: borderRadius.md,
            padding: 3,
            gap: 2,
          },
        ]}
      >
        {segments.map((option) => {
          const selected = value === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={option.disabled ? undefined : () => onChange(option.key)}
              disabled={option.disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: option.disabled }}
              accessibilityLabel={option.label}
              style={[
                styles.segment,
                {
                  borderRadius: borderRadius.sm,
                  backgroundColor: selected ? colors.surface : 'transparent',
                  opacity: option.disabled ? 0.45 : 1,
                },
                selected && styles.segmentSelected,
              ]}
            >
              <MaterialCommunityIcons
                name={option.icon}
                size={16}
                color={
                  option.disabled
                    ? colors.disabledText
                    : selected
                      ? colors.primary.main
                      : colors.text.secondary
                }
              />
              <Text
                numberOfLines={1}
                style={[
                  typography.caption,
                  {
                    fontWeight: selected ? '700' : '600',
                    color: option.disabled
                      ? colors.disabledText
                      : selected
                        ? colors.primary.dark
                        : colors.text.secondary,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showPickupContext ? (
        <ContextLine icon="map-marker-outline">{storeLine}</ContextLine>
      ) : null}
      {showDeliveryContext ? (
        <ContextLine icon="cash" loading={deliveryPriceLoading}>
          {deliveryPriceHint ??
            t('client.placeOrder.summary.deliveryFee', 'Delivery fee') +
              (deliveryPriceLabel ? ` · ${deliveryPriceLabel}` : '')}
        </ContextLine>
      ) : null}
      {helper && (value === 'delivery' || value === 'shipping') ? (
        <Text style={[typography.caption, { color: colors.warning.main }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  segment: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
