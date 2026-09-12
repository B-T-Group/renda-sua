import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export type OrderFulfillment = 'delivery' | 'pickup' | 'shipping';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type ThemeColors = ReturnType<typeof useTheme>['colors'];
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
}

interface FulfillmentOption {
  key: OrderFulfillment;
  title: string;
  subtitle: string;
  icon: IconName;
  disabled: boolean;
}

function FulfillmentTile({
  option,
  selected,
  colors,
  onSelect,
}: {
  option: FulfillmentOption;
  selected: boolean;
  colors: ThemeColors;
  onSelect: (key: OrderFulfillment) => void;
}) {
  const { spacing, borderRadius, typography, shadows } = useTheme();
  const disabled = option.disabled;
  return (
    <Pressable
      onPress={disabled ? undefined : () => onSelect(option.key)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${option.title}. ${option.subtitle}`}
      style={[
        styles.tile,
        shadows.sm,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.md,
          borderColor: selected ? colors.primary.main : colors.divider,
          backgroundColor: selected
            ? colors.primaryTint
            : disabled
              ? colors.pageBackground
              : colors.surface,
        },
        disabled && styles.tileDisabled,
      ]}
    >
      {selected ? (
        <View style={[styles.check, { backgroundColor: colors.primary.main }]}>
          <MaterialCommunityIcons name="check" size={12} color={colors.primary.contrast} />
        </View>
      ) : null}
      <MaterialCommunityIcons
        name={option.icon}
        size={28}
        color={disabled ? colors.disabledText : selected ? colors.primary.main : colors.text.secondary}
      />
      <Text
        numberOfLines={1}
        style={[
          typography.subtitle2,
          {
            marginTop: spacing.xs,
            fontWeight: '700',
            textAlign: 'center',
            color: disabled
              ? colors.disabledText
              : selected
                ? colors.primary.dark
                : colors.text.primary,
          },
        ]}
      >
        {option.title}
      </Text>
      <Text
        numberOfLines={2}
        style={[
          typography.caption,
          {
            marginTop: 2,
            textAlign: 'center',
            color: disabled ? colors.disabledText : colors.text.secondary,
          },
        ]}
      >
        {option.subtitle}
      </Text>
    </Pressable>
  );
}

function buildOptions(
  t: Translate,
  args: {
    deliveryDisabled: boolean;
    pickupAvailable: boolean;
    shippingAvailable: boolean;
    shippingDisabled: boolean;
  }
): FulfillmentOption[] {
  const options: FulfillmentOption[] = [
    {
      key: 'delivery',
      title: t('client.placeOrder.delivery', 'Delivery'),
      subtitle: t('client.placeOrder.deliveryChoiceHint', 'To your address'),
      icon: 'truck-delivery-outline',
      disabled: args.deliveryDisabled,
    },
  ];
  if (args.pickupAvailable) {
    options.push({
      key: 'pickup',
      title: t('client.placeOrder.pickup', 'Pickup'),
      subtitle: t('client.placeOrder.pickupChoiceHint', 'At the store'),
      icon: 'store-marker-outline',
      disabled: false,
    });
  }
  if (args.shippingAvailable || args.shippingDisabled) {
    options.push({
      key: 'shipping',
      title: t('client.placeOrder.shipping', 'Shipping'),
      subtitle: t('client.placeOrder.shippingChoiceHint', 'By carrier'),
      icon: 'package-variant-closed',
      disabled: args.shippingDisabled,
    });
  }
  return options;
}

function SelectedDetail({
  icon,
  title,
  lines,
  loading,
}: {
  icon: IconName;
  title: string;
  lines: string[];
  loading?: boolean;
}) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  return (
    <View
      style={[
        styles.detail,
        {
          padding: spacing.sm,
          borderRadius: borderRadius.md,
          backgroundColor: colors.pageBackground,
          gap: spacing.xs,
        },
      ]}
    >
      <View style={styles.detailHeader}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.text.secondary} />
        <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '600' }]}>
          {title}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary.main} />
      ) : (
        lines.map((line, i) => (
          <Text key={`${i}-${line}`} style={[typography.body2, { color: colors.text.primary }]}>
            {line}
          </Text>
        ))
      )}
    </View>
  );
}

function pickupDetailLines(locations: FulfillmentPickupLocation[]): string[] {
  return locations
    .map((loc) => [loc.name, loc.address].filter(Boolean).join(' · '))
    .filter((line) => line.length > 0);
}

function disabledHelper(
  t: Translate,
  deliveryDisabled: boolean,
  deliveryDisabledReason: string | undefined,
  shippingDisabled: boolean,
  shippingDisabledReason: string | undefined
): string | null {
  if (deliveryDisabled) {
    return (
      deliveryDisabledReason ??
      t('client.placeOrder.deliveryUnavailable', 'Delivery is currently unavailable.')
    );
  }
  if (shippingDisabled) {
    return (
      shippingDisabledReason ??
      t(
        'client.placeOrder.shippingUnavailableMixed',
        'Shipping is only available when every item in your cart can be shipped.'
      )
    );
  }
  return null;
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
}: PlaceOrderFulfillmentChoiceProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const options = buildOptions(t, {
    deliveryDisabled,
    pickupAvailable,
    shippingAvailable,
    shippingDisabled,
  });
  const helper = disabledHelper(
    t,
    deliveryDisabled,
    deliveryDisabledReason,
    shippingDisabled,
    shippingDisabledReason
  );
  const pickupLines = pickupDetailLines(pickupLocations);
  const deliveryLines = deliveryPriceHint
    ? [deliveryPriceHint]
    : deliveryPriceLabel
      ? [deliveryPriceLabel]
      : [];
  const showPickup = value === 'pickup' && pickupLines.length > 0;
  const showDelivery =
    value === 'delivery' && !deliveryDisabled && (deliveryPriceLoading || deliveryLines.length > 0);

  return (
    <View accessibilityRole="radiogroup" style={{ marginBottom: spacing.md, gap: spacing.sm }}>
      <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('client.placeOrder.fulfillmentQuestion', 'How do you want it?')}
      </Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        {options.map((option) => (
          <FulfillmentTile
            key={option.key}
            option={option}
            selected={value === option.key}
            colors={colors}
            onSelect={onChange}
          />
        ))}
      </View>
      {showPickup ? (
        <SelectedDetail
          icon="map-marker-outline"
          title={t('orders.pickupAddressLabel', 'Store address')}
          lines={pickupLines}
        />
      ) : null}
      {showDelivery ? (
        <SelectedDetail
          icon="cash"
          title={t('client.placeOrder.summary.deliveryFee', 'Delivery fee')}
          lines={deliveryLines}
          loading={deliveryPriceLoading}
        />
      ) : null}
      {helper ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 108,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDisabled: {
    opacity: 0.7,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    width: '100%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
