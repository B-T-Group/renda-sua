import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { StorefrontPinIllustration } from '../../illustrations/StorefrontPinIllustration';
import { useTheme } from '../../../contexts/ThemeContext';
import type { DeliveryAddressFormValue } from '../../forms/DeliveryAddressForm';
import { SignupAddressFormSection } from '../SignupAddressFormSection';

export interface StoreLocationStepProps {
  value: DeliveryAddressFormValue;
  onChange: (next: DeliveryAddressFormValue) => void;
  disabled?: boolean;
  postalCodeRequired?: boolean;
}

export function StoreLocationStep({
  value,
  onChange,
  disabled,
  postalCodeRequired,
}: StoreLocationStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  return (
    <View style={styles.wrap}>
      <StorefrontPinIllustration size={112} />
      <Text
        variant="titleMedium"
        style={{
          textAlign: 'center',
          marginTop: spacing.md,
          marginBottom: spacing.xs,
          color: colors.text.primary,
          fontWeight: '700',
        }}
      >
        {t('auth.signupFlow.storeLocationTitle', 'Your first store location')}
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          textAlign: 'center',
          marginBottom: spacing.lg,
          color: colors.text.secondary,
        }}
      >
        {t(
          'auth.signupFlow.storeLocationBody',
          'This becomes your first business location. You can add more locations later.'
        )}
      </Text>
      {postalCodeRequired ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
          {t(
            'auth.signupFlow.postalRequired',
            'A postal code is required for this country.'
          )}
        </Text>
      ) : null}
      <SignupAddressFormSection
        value={value}
        onChange={onChange}
        disabled={disabled}
        disableCountry
        enableAutocomplete
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
