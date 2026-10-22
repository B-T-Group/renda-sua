import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { CountryCode } from 'libphonenumber-js';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PhoneNumberInput from '../PhoneNumberInput';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobileMoneyCountries } from '../../hooks/useMobileMoneyCountries';
import { nationalDigitsToE164 } from '../../utils/phoneLoginUsername';
import {
  pickMobileMoneyDefaultCountry,
  validateOrderPaymentPhone,
} from '../../utils/placeOrderPhoneValidation';

export interface AddPaymentPhoneDialogProps {
  visible: boolean;
  saving: boolean;
  onDismiss: () => void;
  onSave: (phoneE164: string) => Promise<void>;
  /** If a Mobile Money country, used as initial country (e.g. inventory item’s business location). */
  defaultCountryIso?: CountryCode;
  /** When true: backdrop dismiss disabled; Cancel calls onWizardCancel (e.g. go back). */
  mandatoryWizard?: boolean;
  onWizardCancel?: () => void;
}

function isValidOrderPaymentPhone(
  countryIso: CountryCode,
  nationalDigits: string,
  allowed: readonly string[]
): boolean {
  const e164 = nationalDigitsToE164(countryIso, nationalDigits);
  if (!e164) return false;
  return validateOrderPaymentPhone(e164, allowed).ok;
}

function resolveValidationMessage(
  countryIso: CountryCode,
  nationalDigits: string,
  t: TFunction,
  allowed: readonly string[]
): string | null {
  const e164 = nationalDigitsToE164(countryIso, nationalDigits);
  if (!e164) {
    return t('client.placeOrder.payment.invalidPhone', 'Invalid phone number format.');
  }
  const v = validateOrderPaymentPhone(e164, allowed);
  if (v.ok) return null;
  if (v.reason === 'unsupported') {
    return t(
      'client.placeOrder.payment.addPhoneModal.unsupportedCountry',
      'Select Cameroon, Gabon or Togo as the country and enter a valid Mobile Money number.'
    );
  }
  return t('client.placeOrder.payment.invalidPhone', 'Invalid phone number format.');
}

export function AddPaymentPhoneDialog({
  visible,
  saving,
  onDismiss,
  onSave,
  defaultCountryIso,
  mandatoryWizard,
  onWizardCancel,
}: AddPaymentPhoneDialogProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fullScreen = width < 560;

  const { isos: momoIsos } = useMobileMoneyCountries();
  const [countryIso, setCountryIso] = useState<CountryCode>(() =>
    pickMobileMoneyDefaultCountry(defaultCountryIso, momoIsos)
  );
  const [nationalDigits, setNationalDigits] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCountryIso(pickMobileMoneyDefaultCountry(defaultCountryIso, momoIsos));
    setNationalDigits('');
    // momoIsos intentionally omitted: re-seeding on load would clear input.
  }, [visible, defaultCountryIso]);

  const hasDigits = nationalDigits.replace(/\D/g, '').length > 0;
  const canSave = useMemo(
    () => isValidOrderPaymentPhone(countryIso, nationalDigits, momoIsos),
    [countryIso, nationalDigits, momoIsos]
  );
  const validationHint = useMemo(() => {
    if (!nationalDigits.replace(/\D/g, '').length) return null;
    return resolveValidationMessage(countryIso, nationalDigits, t, momoIsos);
  }, [countryIso, nationalDigits, t, momoIsos]);

  const surfaceStyle = fullScreen
    ? {
        marginHorizontal: 0,
        marginVertical: 0,
        borderRadius: 0,
        width: '100%' as const,
        maxWidth: '100%' as const,
        maxHeight: height,
        alignSelf: 'stretch' as const,
      }
    : { maxWidth: Math.min(440, width - 32), alignSelf: 'center' as const };

  const edgePad = fullScreen
    ? { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }
    : {};

  const onSavePress = useCallback(async () => {
    if (!isValidOrderPaymentPhone(countryIso, nationalDigits, momoIsos)) return;
    const e164 = nationalDigitsToE164(countryIso, nationalDigits);
    if (!e164) return;
    try {
      await onSave(e164);
    } catch {
      /* Error message shown via parent Snackbar */
    }
  }, [countryIso, nationalDigits, momoIsos, onSave]);

  const onCancelPress = useCallback(() => {
    if (mandatoryWizard) {
      onWizardCancel?.();
      return;
    }
    onDismiss();
  }, [mandatoryWizard, onDismiss, onWizardCancel]);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={saving ? undefined : onCancelPress}
        dismissable={!saving && !mandatoryWizard}
        style={surfaceStyle}
      >
        <View style={[styles.titleRow, fullScreen ? edgePad : { paddingHorizontal: 24 }]}>
          <View
            style={[styles.iconWrap, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.md }]}
          >
            <MaterialCommunityIcons name="wallet-outline" size={26} color={colors.primary.main} />
          </View>
          <Text variant="titleLarge" style={{ flex: 1, marginLeft: 12 }}>
            {t('client.placeOrder.payment.addPhoneModal.title', 'Add your Mobile Money number')}
          </Text>
        </View>

        <Dialog.ScrollArea
          style={[
            fullScreen
              ? {
                  maxHeight: height - 160,
                  paddingLeft: 16 + insets.left,
                  paddingRight: 16 + insets.right,
                }
              : { maxHeight: height * 0.65 },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollBody}>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 12 }}>
              {t(
                'client.placeOrder.payment.addPhoneModal.body',
                'We send Mobile Money payment requests to this number by default for this order and future ones. You can still use another number for a specific order when placing it.'
              )}
            </Text>
            {mandatoryWizard ? (
              <Text variant="bodyMedium" style={{ color: colors.text.primary, fontWeight: '600', marginBottom: 12 }}>
                {t(
                  'client.placeOrder.wizard.phoneEmphasis',
                  'This number will be used for Mobile Money payments for your orders.'
                )}
              </Text>
            ) : null}
            <Text variant="labelLarge" style={{ marginBottom: 6 }}>
              {t('client.placeOrder.payment.addPhoneModal.phoneLabel', 'Phone number')}
            </Text>
            <PhoneNumberInput
              allowedIsos={momoIsos}
              countryIso={countryIso}
              nationalDigits={nationalDigits}
              onCountryIsoChange={setCountryIso}
              onNationalDigitsChange={setNationalDigits}
              hasError={hasDigits && !canSave}
              disabled={saving}
            />
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 8 }}>
              {t(
                'client.placeOrder.payment.addPhoneModal.supportedHint',
                'Cameroon (+237), Gabon (+241) and Togo (+228) numbers are supported.'
              )}
            </Text>
            {validationHint ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 10 }}>
                {validationHint}
              </Text>
            ) : null}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions style={fullScreen ? edgePad : undefined}>
          <Button onPress={onCancelPress} disabled={saving}>
            {mandatoryWizard
              ? t('client.placeOrder.wizard.exitCheckout', 'Exit')
              : t('client.placeOrder.payment.addPhoneModal.cancel', 'Cancel')}
          </Button>
          <Button
            mode="contained"
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
            onPress={() => void onSavePress()}
            loading={saving}
            disabled={saving || !canSave}
          >
            {t('client.placeOrder.payment.addPhoneModal.save', 'Save to profile')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingBottom: 16,
  },
  saveButton: {
    borderRadius: 0,
  },
  saveButtonContent: {
    borderRadius: 0,
  },
});
