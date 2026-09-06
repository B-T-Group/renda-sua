import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import type { CountryCode } from 'libphonenumber-js';
import { isValidPhoneNumber } from 'libphonenumber-js';
import PhoneNumberInput from '../../PhoneNumberInput';
import { useTheme } from '../../../contexts/ThemeContext';
import { spacing } from '../../../theme';
import { nationalDigitsToE164 } from '../../../utils/phoneLoginUsername';

export interface ContactStepProps {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountry: CountryCode;
  phoneNationalDigits: string;
  emailTaken: boolean;
  checkingEmail: boolean;
  disabled?: boolean;
  /** When market country is known, Stripe countries make phone optional. */
  phoneOptional?: boolean;
  /** Lock dial-code to market/device country (signup keeps phone tied to market). */
  disableCountryPicker?: boolean;
  onChangeFirstName: (v: string) => void;
  onChangeLastName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangePhoneCountry: (v: CountryCode) => void;
  onChangePhoneNationalDigits: (v: string) => void;
  onLoginInstead?: () => void;
  loginInsteadBusy?: boolean;
}

export function ContactStep({
  firstName,
  lastName,
  email,
  phoneCountry,
  phoneNationalDigits,
  emailTaken,
  checkingEmail,
  disabled,
  phoneOptional = true,
  disableCountryPicker = false,
  onChangeFirstName,
  onChangeLastName,
  onChangeEmail,
  onChangePhoneCountry,
  onChangePhoneNationalDigits,
  onLoginInstead,
  loginInsteadBusy = false,
}: ContactStepProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const phoneE164 = nationalDigitsToE164(phoneCountry, phoneNationalDigits);
  const phoneValid = Boolean(phoneE164 && isValidPhoneNumber(phoneE164));
  const phoneEntered = phoneNationalDigits.trim().length > 0;

  return (
    <View>
      <TextInput
        mode="outlined"
        label={t('auth.firstName', 'First name')}
        value={firstName}
        onChangeText={onChangeFirstName}
        disabled={disabled}
        style={styles.field}
      />
      <TextInput
        mode="outlined"
        label={t('auth.lastName', 'Last name')}
        value={lastName}
        onChangeText={onChangeLastName}
        disabled={disabled}
        style={styles.field}
      />
      <TextInput
        mode="outlined"
        label={t('auth.email', 'Email')}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        disabled={disabled}
        error={emailTaken}
        style={styles.field}
      />
      {emailTaken ? (
        <View style={styles.emailTakenRow}>
          <Text
            variant="bodySmall"
            style={[styles.emailTakenText, { color: colors.error.main }]}
          >
            {t('auth.signupFlow.emailTaken', 'This email is already in use.')}
          </Text>
          {onLoginInstead ? (
            <Button
              mode="text"
              compact
              onPress={onLoginInstead}
              loading={loginInsteadBusy}
              disabled={disabled || loginInsteadBusy}
              style={styles.loginInsteadBtn}
            >
              {t('auth.signupFlow.logInInstead', 'Log in instead')}
            </Button>
          ) : null}
        </View>
      ) : null}
      <HelperText type="info" visible={checkingEmail && !emailTaken}>
        {t('auth.signupFlow.checkingEmail', 'Checking email availability…')}
      </HelperText>
      <View style={styles.phoneLabelRow}>
        <Text variant="labelLarge" style={{ color: colors.text.secondary }}>
          {t('auth.phone', 'Phone number')}
        </Text>
        {phoneOptional ? (
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('auth.signupFlow.phoneOptional', '(optional)')}
          </Text>
        ) : null}
      </View>
      <PhoneNumberInput
        countryIso={phoneCountry}
        nationalDigits={phoneNationalDigits}
        onCountryIsoChange={onChangePhoneCountry}
        onNationalDigitsChange={onChangePhoneNationalDigits}
        disabled={disabled}
        disableCountryPicker={disableCountryPicker}
        hasError={phoneEntered && !phoneValid}
      />
      <HelperText type="info" visible style={styles.phoneNote}>
        {phoneOptional
          ? t(
              'auth.signupFlow.phoneOptionalNote',
              'Adding your phone number makes it easy for us to reach you.'
            )
          : t(
              'auth.signupFlow.phonePaymentsNote',
              'Payments and payouts for your account will be sent to this phone number.'
            )}
      </HelperText>
      <HelperText type="info" visible>
        {t(
          'auth.signupFlow.trustContact',
          "We'll only use this to verify your account and send order updates."
        )}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 8 },
  phoneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  phoneNote: { marginTop: 0, marginBottom: 8 },
  emailTakenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xxs,
    marginBottom: spacing.xxs,
    minWidth: 0,
  },
  emailTakenText: { flexShrink: 1, minWidth: 0 },
  loginInsteadBtn: { marginLeft: -spacing.xs },
});
