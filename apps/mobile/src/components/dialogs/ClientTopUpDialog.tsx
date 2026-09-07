import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import { Portal, Dialog, Button, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { e164ToCountryAndNational } from '../../utils/phoneLoginUsername';
import {
  MIN_WITHDRAW_AMOUNT_XAF,
  isWithdrawPhoneFormValid,
  withdrawPhoneFormToE164,
} from '../../utils/withdrawValidation';
import PhoneNumberInput from '../PhoneNumberInput';

export interface ClientTopUpDialogProps {
  visible: boolean;
  onDismiss: () => void;
  defaultPhone: string;
  currency: string;
  submitting: boolean;
  onConfirm: (phoneE164: string, amount: number) => Promise<{ success: boolean; message?: string }>;
}

function pickDefaultMobileMoneyCountry(preferred?: CountryCode): CountryCode {
  if (preferred === 'CM' || preferred === 'GA') return preferred;
  const d = getDeviceDefaultCountryCode();
  return d === 'CM' || d === 'GA' ? d : 'CM';
}

function initialTopUpPhone(defaultPhone: string): { countryIso: CountryCode; nationalDigits: string } {
  const raw = defaultPhone.trim();
  if (!raw) {
    return { countryIso: pickDefaultMobileMoneyCountry(), nationalDigits: '' };
  }
  const parsed = e164ToCountryAndNational(raw);
  if (parsed && (parsed.countryIso === 'CM' || parsed.countryIso === 'GA')) {
    return parsed;
  }
  return { countryIso: pickDefaultMobileMoneyCountry(), nationalDigits: '' };
}

export function ClientTopUpDialog({
  visible,
  onDismiss,
  defaultPhone,
  currency,
  submitting,
  onConfirm,
}: ClientTopUpDialogProps) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const [countryIso, setCountryIso] = useState<CountryCode>('CM');
  const [nationalDigits, setNationalDigits] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const phoneTouchedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      phoneTouchedRef.current = false;
      return;
    }
    setAmount('');
    setError('');
  }, [visible]);

  useEffect(() => {
    if (!visible || phoneTouchedRef.current) return;
    const init = initialTopUpPhone(defaultPhone);
    setCountryIso(init.countryIso);
    setNationalDigits(init.nationalDigits);
  }, [visible, defaultPhone]);

  const parsedAmount = parseFloat(amount);
  const amountOk =
    amount.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_WITHDRAW_AMOUNT_XAF;
  const phoneOk = isWithdrawPhoneFormValid(countryIso, nationalDigits);
  const hasDigits = nationalDigits.replace(/\D/g, '').length > 0;
  const canSubmit = phoneOk && amountOk && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    const e164 = withdrawPhoneFormToE164(countryIso, nationalDigits);
    if (!e164) {
      setError(
        t(
          'accounts.withdrawPhoneCmGaOnly',
          'Only Cameroon (+237) or Gabon (+241) phone numbers are supported.'
        )
      );
      return;
    }
    setError('');
    const res = await onConfirm(e164, parsedAmount);
    if (res.success) onDismiss();
    else setError(res.message ?? t('accounts.topUpFailed', 'Top-up could not be started.'));
  }, [canSubmit, submitting, countryIso, nationalDigits, parsedAmount, onConfirm, onDismiss, t]);

  const hint = useMemo(
    () =>
      t(
        'accounts.withdrawPhoneCmGaHint',
        'Use a Cameroon (+237) or Gabon (+241) mobile number.'
      ),
    [t]
  );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={submitting ? undefined : onDismiss} dismissable={!submitting}>
        <Dialog.Title style={{ color: colors.text.primary }}>
          {t('accounts.topUpRequest', 'Top up')}
        </Dialog.Title>
        <Dialog.ScrollArea style={{ maxHeight: 420 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollBody}>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 8 }}>
              {t('accounts.minTopUpAmount', 'Minimum top-up is {{min}} {{currency}}.', {
                min: MIN_WITHDRAW_AMOUNT_XAF,
                currency,
              })}
            </Text>
            <Text variant="labelLarge" style={{ color: colors.text.primary, marginBottom: 6 }}>
              {t('accounts.mobileMoneyPhone', 'Mobile Money phone')}
            </Text>
            <PhoneNumberInput
              countryIso={countryIso}
              nationalDigits={nationalDigits}
              onCountryIsoChange={(iso) => {
                phoneTouchedRef.current = true;
                setCountryIso(iso);
              }}
              onNationalDigitsChange={(digits) => {
                phoneTouchedRef.current = true;
                setNationalDigits(digits);
              }}
              hasError={hasDigits && !phoneOk}
              disabled={submitting}
            />
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 8, marginBottom: 12 }}>
              {hint}
            </Text>
            <Text variant="labelLarge" style={{ color: colors.text.primary, marginBottom: 4 }}>
              {t('accounts.amount', 'Amount')}
            </Text>
            <TextInput
              mode="outlined"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!submitting}
              placeholder={String(MIN_WITHDRAW_AMOUNT_XAF)}
              style={[typography.body2 as object]}
            />
            {error ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 8 }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button mode="contained" onPress={() => void handleSubmit()} loading={submitting} disabled={!canSubmit}>
            {t('accounts.topUp', 'Top up')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  actions: { flexWrap: 'wrap', gap: 4 },
  scrollBody: { paddingBottom: 8 },
});
