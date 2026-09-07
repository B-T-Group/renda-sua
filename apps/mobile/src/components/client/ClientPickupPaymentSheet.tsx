import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import { Button, Switch, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PhoneNumberInput from '../PhoneNumberInput';
import { useTheme } from '../../contexts/ThemeContext';
import type { Order } from '../../types/agent';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import {
  e164ToCountryAndNational,
  nationalDigitsToE164,
} from '../../utils/phoneLoginUsername';
import { pickMobileMoneyDefaultCountry } from '../../utils/placeOrderPhoneValidation';

function isPickupMomoPhone(phone: string): boolean {
  const parsed = e164ToCountryAndNational(phone);
  return parsed?.countryIso === 'CM' || parsed?.countryIso === 'GA';
}

type Props = {
  visible: boolean;
  order: Order;
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (phoneNumber?: string) => Promise<void>;
};

export function ClientPickupPaymentSheet({
  visible,
  order,
  loading,
  onDismiss,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const clientPhone = order.client?.user?.phone_number?.trim() ?? '';
  const profilePhoneOk = isPickupMomoPhone(clientPhone);
  const itemCountry = order.business_location?.address?.country;
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
    const fallback = pickMobileMoneyDefaultCountry(
      itemCountry ?? getDeviceDefaultCountryCode()
    );
    setUseDifferent(!profilePhoneOk);
    if (profilePhoneOk) {
      const parsed = e164ToCountryAndNational(clientPhone);
      if (parsed) {
        setCountryIso(parsed.countryIso);
        setNationalDigits(parsed.nationalDigits);
        return;
      }
    }
    setCountryIso(fallback);
    setNationalDigits('');
  }, [visible, clientPhone, profilePhoneOk, itemCountry, order.id]);

  const overrideE164 = nationalDigitsToE164(countryIso, nationalDigits);
  const canSubmit = useDifferent ? overrideE164 !== null : profilePhoneOk;

  const handleSubmit = async () => {
    if (useDifferent) {
      if (!overrideE164) return;
      await onSubmit(overrideE164);
      return;
    }
    await onSubmit(undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={typography.titleMedium}>
            {t('orders.payAtPickup.title', 'Pay at pickup')}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, marginTop: spacing.sm }}
          >
            {t(
              'orders.payAtPickup.hint',
              'We will send a mobile money request to this number. Approve it on your phone. The store will see the payment, then you can collect your order.'
            )}
          </Text>
          {clientPhone && !useDifferent ? (
            <Text variant="bodySmall" style={{ marginTop: spacing.sm }}>
              {t('orders.payAtPickup.phoneLabel', 'Payment phone')}: {clientPhone}
            </Text>
          ) : null}
          <View style={[styles.row, { marginTop: spacing.md }]}>
            <Text style={{ flex: 1, minWidth: 0 }}>
              {t('orders.useDifferentPhone', 'Use a different phone number')}
            </Text>
            <Switch
              value={useDifferent}
              onValueChange={setUseDifferent}
              disabled={!profilePhoneOk}
            />
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
          <View style={[styles.actions, { marginTop: spacing.md, gap: spacing.sm }]}>
            <Button mode="text" onPress={onDismiss} disabled={loading}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              loading={loading}
              disabled={!canSubmit || loading}
              onPress={() => void handleSubmit()}
            >
              {t('orders.payAtPickup.cta', 'Pay now')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
