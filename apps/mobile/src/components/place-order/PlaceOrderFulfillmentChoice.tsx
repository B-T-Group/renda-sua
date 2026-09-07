import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { SelectionCard } from '../common/SelectionCard';

export type OrderFulfillment = 'delivery' | 'pickup' | 'shipping';

interface PlaceOrderFulfillmentChoiceProps {
  value: OrderFulfillment;
  onChange: (value: OrderFulfillment) => void;
  /** When true, delivery cannot be chosen (e.g. backend says unavailable). */
  deliveryDisabled?: boolean;
  /** Shown as the delivery card description when disabled. */
  deliveryDisabledReason?: string;
  pickupAvailable?: boolean;
  shippingAvailable?: boolean;
  shippingDisabled?: boolean;
  shippingDisabledReason?: string;
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
}: PlaceOrderFulfillmentChoiceProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, shadows, spacing } = useTheme();

  const deliveryDescription = deliveryDisabled
    ? (deliveryDisabledReason ??
      t('client.placeOrder.deliveryUnavailable', 'Delivery is currently unavailable.'))
    : t(
        'client.placeOrder.deliveryChoiceHint',
        'Have your order brought to your delivery address.'
      );

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.container,
        shadows.sm,
        {
          backgroundColor: colors.primary.hover,
          borderColor: colors.primary.main,
          borderRadius: borderRadius.md,
          gap: spacing.sm,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <View style={[styles.heading, { gap: spacing.sm }]}>
        <View
          style={[
            styles.headingIcon,
            { backgroundColor: colors.primary.main, borderRadius: borderRadius.icon },
          ]}
        >
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={24}
            color={colors.primary.contrast}
          />
        </View>
        <View style={styles.headingCopy}>
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {t('client.placeOrder.fulfillmentQuestion', 'How would you like to receive your order?')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
            {t('client.placeOrder.fulfillmentHint', 'You can change this anytime.')}
          </Text>
        </View>
      </View>

      <SelectionCard
        title={t('client.placeOrder.delivery', 'Delivery')}
        description={deliveryDescription}
        leadingIcon="truck-delivery-outline"
        radioMode
        isSelected={value === 'delivery'}
        isDisabled={deliveryDisabled}
        onPress={() => onChange('delivery')}
        accessibilityLabel={
          deliveryDisabled
            ? `${t('client.placeOrder.delivery', 'Delivery')}. ${deliveryDescription}`
            : undefined
        }
      />
      {pickupAvailable ? (
        <SelectionCard
          title={t('client.placeOrder.pickup', 'Pickup')}
          description={t(
            'client.placeOrder.pickupChoiceHint',
            'Collect your order directly from the store.'
          )}
          leadingIcon="store-marker-outline"
          radioMode
          isSelected={value === 'pickup'}
          onPress={() => onChange('pickup')}
        />
      ) : null}
      {shippingAvailable || shippingDisabled ? (
        <SelectionCard
          title={t('client.placeOrder.shipping', 'Shipping')}
          description={
            shippingDisabled
              ? (shippingDisabledReason ??
                t(
                  'client.placeOrder.shippingUnavailableMixed',
                  'Shipping is only available when every item in your cart can be shipped.'
                ))
              : t(
                  'client.placeOrder.shippingChoiceHint',
                  'The seller sends this with a carrier to your address.'
                )
          }
          leadingIcon="package-variant-closed"
          radioMode
          isSelected={value === 'shipping'}
          isDisabled={shippingDisabled}
          onPress={() => onChange('shipping')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headingIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
});
