import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CountryCode } from 'libphonenumber-js';
import { useTheme } from '../../contexts/ThemeContext';
import PhoneNumberInput from '../PhoneNumberInput';
import { nationalDigitsToE164 } from '../../utils/phoneLoginUsername';
import { pickMobileMoneyDefaultCountry } from '../../utils/placeOrderPhoneValidation';

interface Props {
  visible: boolean;
  itemCountry?: string | null;
  onDismiss: () => void;
  onSubmit: (phone: string, reference?: string, notes?: string) => Promise<void>;
  loading?: boolean;
}

export function ReconcileCashDialog({
  visible,
  itemCountry,
  onDismiss,
  onSubmit,
  loading,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [countryIso, setCountryIso] = useState<CountryCode>(() =>
    pickMobileMoneyDefaultCountry(itemCountry)
  );
  const [nationalDigits, setNationalDigits] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCountryIso(pickMobileMoneyDefaultCountry(itemCountry));
    setNationalDigits('');
    setReference('');
    setNotes('');
  }, [visible, itemCountry]);

  const e164 = nationalDigitsToE164(countryIso, nationalDigits);

  const handleSubmit = async () => {
    if (!e164) return;
    await onSubmit(e164, reference.trim() || undefined, notes.trim() || undefined);
    setNationalDigits('');
    setReference('');
    setNotes('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={loading ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={[styles.title, { color: colors.text.primary }]}>
            {t('business.orders.reconcileTitle', 'Reconcile cash exception')}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <Text variant="bodyMedium" style={[styles.hint, { color: colors.text.secondary }]}>
              {t(
                'business.orders.reconcileHint',
                'Enter the customer mobile number used for payment (E.164, e.g. +241...)'
              )}
            </Text>
            <PhoneNumberInput
              countryIso={countryIso}
              nationalDigits={nationalDigits}
              onCountryIsoChange={setCountryIso}
              onNationalDigitsChange={setNationalDigits}
              allowedIsos={['CM', 'GA']}
              hasError={nationalDigits.length > 0 && !e164}
              disabled={loading}
            />
            <TextInput
              label={t('business.orders.paymentReference', 'Reference (optional)')}
              value={reference}
              onChangeText={setReference}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label={t('business.orders.notes', 'Notes (optional)')}
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              style={styles.input}
            />
          </ScrollView>
          <View style={[styles.actions, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
            <Button onPress={onDismiss} disabled={loading} mode="text">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button loading={loading} disabled={!e164 || loading} onPress={() => void handleSubmit()}>
              {t('business.orders.reconcileSubmit', 'Reconcile')}
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: { overflow: 'hidden' },
  title: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    fontWeight: '700',
  },
  hint: { marginBottom: 12 },
  input: { marginTop: 8 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
  },
});
