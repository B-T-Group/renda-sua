import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import {
  AddressCapture,
  type AddressCaptureContext,
} from '../forms/AddressCapture';
import {
  type DeliveryAddressFormValue,
} from '../forms/DeliveryAddressForm';

export function isSignupAddressComplete(v: DeliveryAddressFormValue): boolean {
  return Boolean(
    v.address_line_1.trim() && v.country && v.state && v.city.trim()
  );
}

export interface SignupAddressFormSectionProps {
  value: DeliveryAddressFormValue;
  onChange: (next: DeliveryAddressFormValue) => void;
  disabled?: boolean;
  showHeader?: boolean;
  showStepHint?: boolean;
  disableCountry?: boolean;
  enableAutocomplete?: boolean;
  captureContext?: AddressCaptureContext;
}

export function SignupAddressFormSection({
  value,
  onChange,
  disabled = false,
  showHeader = true,
  showStepHint = false,
  disableCountry = false,
  enableAutocomplete = true,
  captureContext = 'store',
}: SignupAddressFormSectionProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  return (
    <View style={styles.wrap}>
      {showHeader ? (
        <>
          <Text variant="titleMedium" style={{ marginBottom: spacing.sm, color: colors.text.primary }}>
            {t('auth.signupFlow.addressModalTitle', 'Your address')}
          </Text>
          <Text variant="bodySmall" style={{ marginBottom: spacing.md, color: colors.text.secondary }}>
            {t(
              'auth.signupFlow.addressModalSubtitle',
              'We use this to tailor delivery and local options.'
            )}
          </Text>
        </>
      ) : null}
      {showStepHint ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
          {t(
            'auth.signupFlow.addressStepHint',
            'Country defaults to your device region. You can change it in the form.'
          )}
        </Text>
      ) : null}
      <AddressCapture
        value={value}
        onChange={onChange}
        disabled={disabled}
        disableCountry={disableCountry}
        enableAutocomplete={enableAutocomplete}
        context={captureContext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
