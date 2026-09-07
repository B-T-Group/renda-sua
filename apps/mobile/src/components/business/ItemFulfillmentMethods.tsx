import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { isShippingPriceValid } from '../../utils/itemFulfillment';
import { SelectionCard } from '../common/SelectionCard';

export interface ItemFulfillmentMethodsProps {
  pickupEnabled: boolean;
  shippingEnabled: boolean;
  shippingPrice: string;
  currency: string;
  onPickupChange: (enabled: boolean) => void;
  onShippingChange: (enabled: boolean) => void;
  onShippingPriceChange: (price: string) => void;
}

export function ItemFulfillmentMethods({
  pickupEnabled,
  shippingEnabled,
  shippingPrice,
  currency,
  onPickupChange,
  onShippingChange,
  onShippingPriceChange,
}: ItemFulfillmentMethodsProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const priceInvalid = !isShippingPriceValid(shippingEnabled, shippingPrice);

  return (
    <View style={[styles.root, { gap: spacing.sm }]}>
      <SelectionCard
        title={t('business.items.fulfillment.delivery', 'Delivery')}
        subtitle={t('business.items.fulfillment.alwaysIncluded', 'Always included')}
        description={t(
          'business.items.fulfillment.deliveryHint',
          'A Rendasua agent brings the order to the customer.'
        )}
        leadingIcon="truck-delivery-outline"
        isSelected
      />
      <SelectionCard
        title={t('business.items.fulfillment.pickup', 'Pickup')}
        description={t(
          'business.items.fulfillment.pickupHint',
          'Customers collect the order at your store.'
        )}
        leadingIcon="store-marker-outline"
        isSelected={pickupEnabled}
        onPress={() => onPickupChange(!pickupEnabled)}
      />
      <SelectionCard
        title={t('business.items.fulfillment.shipping', 'Shipping')}
        description={t(
          'business.items.fulfillment.shippingHint',
          'You send it with a carrier.'
        )}
        leadingIcon="package-variant-closed"
        isSelected={shippingEnabled}
        onPress={() => onShippingChange(!shippingEnabled)}
      />
      {shippingEnabled ? (
        <View style={{ marginTop: spacing.xs }}>
          <TextInput
            mode="outlined"
            label={t(
              'business.items.fulfillment.shippingPrice',
              'Shipping price ({{currency}})',
              { currency }
            )}
            value={shippingPrice}
            onChangeText={onShippingPriceChange}
            keyboardType="decimal-pad"
            error={priceInvalid}
          />
          {priceInvalid ? (
            <Text
              variant="bodySmall"
              style={{ color: colors.error.main, marginTop: spacing.xs }}
            >
              {t(
                'business.items.fulfillment.shippingPriceRequired',
                'Enter a shipping price. Use 0 for free shipping.'
              )}
            </Text>
          ) : (
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginTop: spacing.xs }}
            >
              {t(
                'business.items.fulfillment.shippingPriceHint',
                'Charged per item when the customer chooses shipping.'
              )}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
