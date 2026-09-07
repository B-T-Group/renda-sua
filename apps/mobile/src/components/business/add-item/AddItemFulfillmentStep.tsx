import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { isShippingPriceValid } from '../../../utils/itemFulfillment';
import { ItemFulfillmentIllustration } from '../../illustrations/ItemFulfillmentIllustration';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import { ItemFulfillmentMethods } from '../ItemFulfillmentMethods';
import type { AiReviewFormValues } from './AddItemAiReviewStep';

export interface AddItemFulfillmentStepProps {
  values: AiReviewFormValues;
  currency: string;
  busy: boolean;
  onChange: (values: AiReviewFormValues) => void;
  onContinue: () => void;
}

export function AddItemFulfillmentStep({
  values,
  currency,
  busy,
  onChange,
  onContinue,
}: AddItemFulfillmentStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const canContinue = isShippingPriceValid(
    values.shippingEnabled,
    values.shippingPrice
  );

  const patch = (partial: Partial<AiReviewFormValues>) => {
    onChange({ ...values, ...partial });
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
    >
      <ItemFulfillmentIllustration />
      <Text
        variant="titleMedium"
        style={[styles.title, { color: colors.text.primary, marginTop: spacing.md }]}
      >
        {t(
          'business.items.fulfillment.question',
          'How can customers get this product?'
        )}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginTop: spacing.xs }}
      >
        {t(
          'business.items.fulfillment.subtitle',
          'Delivery by a Rendasua agent is always included.'
        )}
      </Text>
      <View style={{ marginTop: spacing.lg }}>
        <ItemFulfillmentMethods
          pickupEnabled={values.payAtPickupEnabled}
          shippingEnabled={values.shippingEnabled}
          shippingPrice={values.shippingPrice}
          currency={currency}
          onPickupChange={(payAtPickupEnabled) => patch({ payAtPickupEnabled })}
          onShippingChange={(shippingEnabled) => patch({ shippingEnabled })}
          onShippingPriceChange={(shippingPrice) => patch({ shippingPrice })}
        />
      </View>
      <Button
        mode="contained"
        onPress={onContinue}
        disabled={busy || !canContinue}
        style={{ marginTop: spacing.lg }}
      >
        {t('common.continue', 'Continue')}
      </Button>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
