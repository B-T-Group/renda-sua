import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Switch, Text, TextInput } from 'react-native-paper';
import type { CountryCode } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import PhoneNumberInput from '../PhoneNumberInput';
import { validateRecipientContact } from '../../utils/diasporaCheckout';
import {
  nationalDigitsToE164,
  seedPhoneInputFromE164,
} from '../../utils/phoneLoginUsername';
import type { RecipientContact } from '../../types/clientOrder';

const RECIPIENT_PHONE_ISOS: CountryCode[] = ['CM', 'GA'];

export interface RecipientDetailsBlockProps {
  /** Current recipient data (name, phone, notify_whatsapp). */
  recipient: Partial<RecipientContact>;
  /** Callback when recipient data changes. */
  onChange: (value: Partial<RecipientContact>) => void;
  /** Default country code for the phone input (derived from fulfillment country). */
  defaultCountryCode?: CountryCode;
  /** Disable all inputs (e.g. during submission). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function resolvePhoneCountry(
  defaultCountryCode: CountryCode | undefined,
  seededIso: CountryCode
): CountryCode {
  if (defaultCountryCode && RECIPIENT_PHONE_ISOS.includes(defaultCountryCode)) {
    return defaultCountryCode;
  }
  return RECIPIENT_PHONE_ISOS.includes(seededIso) ? seededIso : 'GA';
}

/**
 * Recipient details block for diaspora orders.
 * Collects recipient name, phone (E.164), and WhatsApp notification preference.
 */
export function RecipientDetailsBlock({
  recipient,
  onChange,
  defaultCountryCode,
  disabled,
  style,
}: RecipientDetailsBlockProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing, shadows } = useTheme();
  const [countryIso, setCountryIso] = useState<CountryCode>(
    defaultCountryCode && RECIPIENT_PHONE_ISOS.includes(defaultCountryCode)
      ? defaultCountryCode
      : 'GA'
  );
  const [nationalDigits, setNationalDigits] = useState('');

  useEffect(() => {
    if (defaultCountryCode && RECIPIENT_PHONE_ISOS.includes(defaultCountryCode)) {
      setCountryIso(defaultCountryCode);
    }
    const phone = recipient.phone?.trim() ?? '';
    if (!phone) {
      setNationalDigits('');
      return;
    }
    if (!phone.startsWith('+')) return;
    const seeded = seedPhoneInputFromE164(phone, defaultCountryCode ?? 'GA');
    setNationalDigits(seeded.nationalDigits);
    if (!defaultCountryCode) {
      setCountryIso(resolvePhoneCountry(undefined, seeded.countryIso));
    }
  }, [recipient.phone, defaultCountryCode]);

  const validation = useMemo(
    () => validateRecipientContact(recipient),
    [recipient]
  );

  const emitPhone = useCallback(
    (iso: CountryCode, digits: string) => {
      const e164 = nationalDigitsToE164(iso, digits);
      onChange({ ...recipient, phone: e164 ?? digits });
    },
    [onChange, recipient]
  );

  const handleNameChange = useCallback(
    (name: string) => {
      onChange({ ...recipient, name });
    },
    [onChange, recipient]
  );

  const handleCountryIsoChange = useCallback(
    (iso: CountryCode) => {
      setCountryIso(iso);
      emitPhone(iso, nationalDigits);
    },
    [emitPhone, nationalDigits]
  );

  const handleNationalDigitsChange = useCallback(
    (digits: string) => {
      setNationalDigits(digits);
      emitPhone(countryIso, digits);
    },
    [countryIso, emitPhone]
  );

  const handleWhatsAppToggle = useCallback(() => {
    onChange({ ...recipient, notify_whatsapp: !recipient.notify_whatsapp });
  }, [onChange, recipient]);

  const nameError = validation === 'missing_name';
  const phoneError = validation === 'missing_phone';
  const lockCountry = Boolean(defaultCountryCode);

  return (
    <View
      style={[
        styles.container,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderColor: colors.divider,
          padding: spacing.md,
          gap: spacing.md,
        },
        style,
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('diaspora.recipientDetails', 'Recipient details')}
      </Text>

      <TextInput
        label={t('diaspora.recipientName', 'Recipient name')}
        value={recipient.name ?? ''}
        onChangeText={handleNameChange}
        mode="outlined"
        disabled={disabled}
        error={nameError}
        placeholder={t('diaspora.recipientNamePlaceholder', 'Full name')}
        outlineStyle={{ borderRadius: borderRadius.input }}
      />

      <View>
        <Text
          variant="labelLarge"
          style={{ color: colors.text.secondary, marginBottom: spacing.xs }}
        >
          {t('diaspora.recipientPhone', 'Recipient phone')}
        </Text>
        <PhoneNumberInput
          countryIso={countryIso}
          nationalDigits={nationalDigits}
          onCountryIsoChange={handleCountryIsoChange}
          onNationalDigitsChange={handleNationalDigitsChange}
          hasError={phoneError}
          disabled={disabled}
          disableCountryPicker={lockCountry}
          allowedIsos={RECIPIENT_PHONE_ISOS}
        />
        {phoneError ? (
          <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.xs }}>
            {t('diaspora.recipientPhoneRequired', 'Phone number required')}
          </Text>
        ) : null}
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            {t('diaspora.sendWhatsAppUpdates', 'Send WhatsApp updates')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t(
              'diaspora.notifyRecipientWhatsApp',
              'Only if they agreed to receive Rendasua WhatsApp messages about this delivery'
            )}
          </Text>
        </View>
        <Switch
          value={recipient.notify_whatsapp ?? false}
          onValueChange={handleWhatsAppToggle}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
