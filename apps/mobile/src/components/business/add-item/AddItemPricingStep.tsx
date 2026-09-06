import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import { ProductTaxCategoryField } from '../ProductTaxCategoryField';
import { useTheme } from '../../../contexts/ThemeContext';
import type { UseAddItemFormResult } from '../../../hooks/business/useAddItemForm';
import type { AddItemFormValues } from '../../../hooks/business/useAddItemForm';

export interface AddItemPricingStepProps {
  form: UseAddItemFormResult;
  busy: boolean;
  onSubmit: (values: AddItemFormValues) => void;
}

export function AddItemPricingStep({ form, busy, onSubmit }: AddItemPricingStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const handleSubmit = () => {
    if (!form.pricingComplete) return;
    onSubmit(form.buildForm());
  };

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={styles.content}
      wrapAvoidingView={false}
    >
      <Text
        variant="bodyMedium"
        style={[styles.hint, { color: colors.text.secondary }]}
      >
        {t(
          'business.onboarding.firstSale.create.pricingHint',
          'Set the price customers will see for this product.'
        )}
      </Text>

      {form.showTaxCategory ? (
        <ProductTaxCategoryField
          value={form.stripeTaxCodeId}
          onChange={form.setStripeTaxCodeId}
          disabled={busy || form.stripeRailLoading}
        />
      ) : null}

      <TextInput
        label={`${t('business.onboarding.firstSale.create.price', 'Price')} *`}
        value={form.price}
        onChangeText={form.setPrice}
        keyboardType="decimal-pad"
        mode="outlined"
        error={form.price.trim() !== '' && !form.priceValid}
        style={[styles.field, { marginTop: form.showTaxCategory ? 0 : spacing.xs }]}
        right={
          <TextInput.Affix text={form.currency || (form.defaultCurrency ?? '—')} />
        }
      />
      <Text
        variant="bodySmall"
        style={[styles.currencyHint, { color: colors.text.secondary }]}
      >
        {t(
          'business.items.currencyLockedToCountry',
          'Locked to your business country'
        )}
      </Text>

      <Button
        mode="contained"
        loading={busy}
        disabled={busy || !form.pricingComplete}
        onPress={handleSubmit}
        style={{ marginTop: spacing.sm }}
      >
        {t('business.onboarding.firstSale.create.saveContinue', 'Save & continue')}
      </Button>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  hint: { marginBottom: 16 },
  field: { marginBottom: 4 },
  currencyHint: { marginBottom: 12 },
});
