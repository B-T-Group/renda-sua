import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import { Button, Dialog, Portal, Switch, Text } from 'react-native-paper';
import type { BusinessOrder } from '../../types/business/orders';
import PhoneNumberInput from '../PhoneNumberInput';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { e164ToCountryAndNational, nationalDigitsToE164 } from '../../utils/phoneLoginUsername';
import { pickMobileMoneyDefaultCountry } from '../../utils/placeOrderPhoneValidation';

interface Props {
  visible: boolean;
  order: BusinessOrder | null;
  onDismiss: () => void;
  onSubmit: (phoneNumber?: string) => Promise<void>;
  onSuccess?: (phoneNumber: string) => void;
  loading?: boolean;
}

export function BusinessPickupPaymentDialog({ visible, order, onDismiss, onSubmit, onSuccess, loading }: Props) {
  const { t } = useTranslation();
  const clientPhone = order?.client?.user?.phone_number?.trim() ?? '';
  const itemCountry = order?.business_location?.address?.country;
  const [useDifferent, setUseDifferent] = useState(false);
  const [countryIso, setCountryIso] = useState<CountryCode>(() =>
    pickMobileMoneyDefaultCountry(itemCountry)
  );
  const [nationalDigits, setNationalDigits] = useState('');

  useEffect(() => {
    if (!visible) {
      setUseDifferent(false);
      setNationalDigits('');
      setCountryIso(pickMobileMoneyDefaultCountry(itemCountry));
      return;
    }
    const noPhone = !clientPhone;
    setUseDifferent(noPhone);
    const fallback = pickMobileMoneyDefaultCountry(
      itemCountry ?? getDeviceDefaultCountryCode()
    );
    if (clientPhone) {
      const parsed = e164ToCountryAndNational(clientPhone);
      if (parsed && (parsed.countryIso === 'CM' || parsed.countryIso === 'GA')) {
        setCountryIso(parsed.countryIso);
        setNationalDigits(parsed.nationalDigits);
        return;
      }
    }
    setCountryIso(fallback);
    setNationalDigits('');
  }, [visible, clientPhone, itemCountry, order?.id]);

  const overrideE164 = nationalDigitsToE164(countryIso, nationalDigits);

  const handleSubmit = async () => {
    const phoneToUse = useDifferent ? overrideE164 : clientPhone;
    if (useDifferent) {
      if (!overrideE164) return;
      await onSubmit(overrideE164);
      if (overrideE164) onSuccess?.(overrideE164);
      return;
    }
    await onSubmit(undefined);
    if (phoneToUse) onSuccess?.(phoneToUse);
  };

  if (!order) return null;

  const canSubmit = useDifferent ? overrideE164 !== null : clientPhone.length > 0;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('orderActions.requestPickupPayment', 'Request pickup payment')}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.hint}>
            {t(
              'business.orders.pickupPaymentHint',
              'If the client needs help, send a mobile payment request for this pickup order.'
            )}
          </Text>
          {clientPhone && !useDifferent ? (
            <Text variant="bodySmall" style={{ marginTop: 8 }}>
              {t('business.orders.clientPhone', 'Client phone')}: {clientPhone}
            </Text>
          ) : null}
          <View style={styles.row}>
            <Text style={{ flex: 1 }}>
              {t('business.orders.useDifferentPhone', 'Use a different phone number')}
            </Text>
            <Switch value={useDifferent} onValueChange={setUseDifferent} />
          </View>
          {useDifferent ? (
            <PhoneNumberInput
              countryIso={countryIso}
              nationalDigits={nationalDigits}
              onCountryIsoChange={setCountryIso}
              onNationalDigitsChange={setNationalDigits}
              allowedIsos={['CM', 'GA']}
              hasError={nationalDigits.length > 0 && overrideE164 === null}
              disabled={loading}
            />
          ) : null}
        </Dialog.Content>
        <View style={styles.actions}>
          <Button onPress={onDismiss}>{t('common.cancel', 'Cancel')}</Button>
          <Button loading={loading} disabled={!canSubmit || loading} onPress={() => void handleSubmit()}>
            {t('common.send', 'Send')}
          </Button>
        </View>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  hint: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 8, gap: 8 },
});
