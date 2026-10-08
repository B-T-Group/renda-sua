import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressCapture } from '../forms/AddressCapture';
import type { DeliveryAddressFormValue } from '../forms/DeliveryAddressForm';
import { PlaceOrderWizardHeader } from './PlaceOrderWizardHeader';
import { useTheme } from '../../contexts/ThemeContext';

export interface PlaceOrderAddressStepProps {
  form: DeliveryAddressFormValue;
  onChange: (v: DeliveryAddressFormValue) => void;
  saving: boolean;
  onContinue: () => void;
  locating?: boolean;
  locationDenied?: boolean;
  onUseCurrentLocation?: () => void;
}

export function PlaceOrderAddressStep({
  form,
  onChange,
  saving,
  onContinue,
  locating = false,
  locationDenied = false,
  onUseCurrentLocation,
}: PlaceOrderAddressStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + spacing.xl }]}
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
    >
      <PlaceOrderWizardHeader step={1} />
      <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: spacing.xs }}>
        {t('client.placeOrder.wizard.addressTitle', 'Where should we deliver this?')}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {t(
          'client.placeOrder.wizard.addressIntro',
          'We pre-filled country and city from this listing. Add your street address to continue.'
        )}
      </Text>
      <AddressCapture value={form} onChange={onChange} disabled={saving || locating} context="delivery" />
      {onUseCurrentLocation && !locationDenied ? (
        <Button
          mode="contained"
          icon="crosshairs-gps"
          onPress={onUseCurrentLocation}
          loading={locating}
          disabled={saving || locating}
          style={{ marginTop: spacing.lg }}
        >
          {locating
            ? t('orders.currentLocationResolving', 'Finding your current location…')
            : t('orders.useCurrentLocation', 'Use my current location')}
        </Button>
      ) : null}
      {locationDenied ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.md }}>
          {t('orders.currentLocationDenied', 'Location access was denied')}
        </Text>
      ) : null}
      <Button mode="outlined" onPress={onContinue} loading={saving} disabled={saving || locating} style={{ marginTop: spacing.md }}>
        {t('client.placeOrder.wizard.continue', 'Continue')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 8 },
});
