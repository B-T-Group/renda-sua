import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';

const PLACEHOLDERS = [
  ['business.onboarding.firstSale.hint.example1', 'Coca-Cola Zero 1.5L'],
  ['business.onboarding.firstSale.hint.example2', 'Fresh tomatoes'],
  ['business.onboarding.firstSale.hint.example3', "Women's leather handbag"],
  ['business.onboarding.firstSale.hint.example4', 'Samsung Galaxy A35'],
] as const;

export interface AddItemDescriptionStepProps {
  hint: string;
  price: string;
  currency: string;
  isFoodItem?: boolean;
  busy?: boolean;
  onChange: (hint: string) => void;
  onPriceChange: (price: string) => void;
  onFoodItemChange?: (isFoodItem: boolean) => void;
  onContinue: () => void;
}

function isValidPrice(price: string): boolean {
  const n = Number.parseFloat(price.replace(',', '.'));
  return price.trim().length > 0 && !Number.isNaN(n) && n > 0;
}

export function AddItemDescriptionStep({
  hint,
  price,
  currency,
  isFoodItem = false,
  busy = false,
  onChange,
  onPriceChange,
  onFoodItemChange,
  onContinue,
}: AddItemDescriptionStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [phKey, phDefault] = PLACEHOLDERS[placeholderIndex];
  const priceOk = isValidPrice(price);
  const canContinue = hint.trim().length > 0 && priceOk && !busy;

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.lg) + 24 },
      ]}
      // Shell already has an Appbar; nested KeyboardAvoidingView double-shifts
      // content and hides the focused field above the header on iOS.
      wrapAvoidingView={false}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {t(
          'business.onboarding.firstSale.description.title',
          'What did you photograph?'
        )}
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          color: colors.text.secondary,
          marginTop: spacing.xs,
          marginBottom: spacing.md,
        }}
      >
        {t(
          'business.onboarding.firstSale.description.body',
          'Add a short name and the selling price. We’ll fill the rest — you only review next.'
        )}
      </Text>
      <TextInput
        mode="outlined"
        label={t(
          'business.onboarding.firstSale.description.productLabel',
          'Product'
        )}
        value={hint}
        onChangeText={onChange}
        placeholder={t(phKey, phDefault)}
        style={{ backgroundColor: colors.surface }}
        autoFocus
        accessibilityLabel={t(
          'business.onboarding.firstSale.hint.accessibility',
          'Describe what you photographed'
        )}
        returnKeyType="next"
        blurOnSubmit={false}
      />
      <TextInput
        mode="outlined"
        label={t('business.onboarding.firstSale.create.price', 'Price')}
        value={price}
        onChangeText={onPriceChange}
        placeholder={t(
          'business.onboarding.firstSale.create.priceHelper',
          'e.g. 5000'
        )}
        keyboardType="decimal-pad"
        style={{
          backgroundColor: colors.surface,
          marginTop: spacing.md,
        }}
        right={<TextInput.Affix text={currency} />}
        error={price.trim().length > 0 && !priceOk}
        accessibilityLabel={t(
          'business.onboarding.firstSale.description.priceAccessibility',
          'Selling price'
        )}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => {
          if (canContinue) onContinue();
        }}
      />
      {price.trim().length > 0 && !priceOk ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.error.main, marginTop: spacing.xs }}
        >
          {t(
            'business.onboarding.firstSale.create.priceInvalid',
            'Must be a positive number'
          )}
        </Text>
      ) : (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.xs }}
        >
          {t(
            'business.onboarding.firstSale.description.priceHint',
            'This is the price customers will see. You can still edit it later.'
          )}
        </Text>
      )}
      {onFoodItemChange ? (
        <View
          style={[
            styles.foodRow,
            {
              marginTop: spacing.lg,
              gap: spacing.sm,
            },
          ]}
        >
          <View style={styles.foodCopy}>
            <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
              {t('business.items.isFoodItem', 'This is a cooked food item')}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginTop: spacing.xs }}
            >
              {t(
                'business.items.isFoodItemHelp',
                'Cooked dishes get serving hours per location, and can be marked sold out for the day.'
              )}
            </Text>
          </View>
          <Switch
            value={isFoodItem}
            onValueChange={onFoodItemChange}
            color={colors.primary.main}
          />
        </View>
      ) : null}
      <View style={{ marginTop: spacing.lg }}>
        <Button
          mode="contained"
          disabled={!canContinue}
          onPress={onContinue}
          contentStyle={styles.btnContent}
        >
          {t('common.continue', 'Continue')}
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, flexGrow: 1 },
  btnContent: { minHeight: 48 },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  foodCopy: { flex: 1, minWidth: 0 },
});
