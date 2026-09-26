import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator,
  Button,
  Divider,
  Switch,
  Text,
} from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { TrustBadge } from '../common/TrustBadge';
import { spacing as themeSpacing } from '../../theme/spacing';
import PhoneNumberInput from '../PhoneNumberInput';

export interface PlaceOrderPaymentBlockProps {
  /** When true the client pays by card via Stripe; Mobile Money UI is hidden. */
  isStripeRail?: boolean;
  profileLoading: boolean;
  profilePhone: string | null | undefined;
  useDifferentPhone: boolean;
  onToggleDifferentPhone: (value: boolean) => void;
  overrideCountryIso: CountryCode;
  overrideNationalDigits: string;
  onOverrideCountryIsoChange: (iso: CountryCode) => void;
  onOverrideNationalDigitsChange: (digits: string) => void;
  phoneInvalidReason: 'invalid' | 'unsupported' | null;
  /** Optional — shown only when the profile already has a phone number. */
  onAddPhonePress?: () => void;
}

/** Payment method + phone only. Next-step copy lives on the success screen. */
export function PlaceOrderPaymentBlock({
  isStripeRail = false,
  profileLoading,
  profilePhone,
  useDifferentPhone,
  onToggleDifferentPhone,
  overrideCountryIso,
  overrideNationalDigits,
  onOverrideCountryIsoChange,
  onOverrideNationalDigitsChange,
  phoneInvalidReason,
  onAddPhonePress,
}: PlaceOrderPaymentBlockProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  const unsupportedMsg = t(
    'client.placeOrder.payment.unsupportedCountry',
    'This number is not from a supported country. Use a Cameroon (+237) or Gabon (+241) number, or tap “Use a different phone number”.'
  );
  const invalidMsg = t('client.placeOrder.payment.invalidPhone', 'Invalid phone number format.');

  return (
    <View
      style={{
        padding: 16,
        borderWidth: 1,
        marginBottom: 12,
        borderColor: colors.divider,
        borderRadius: borderRadius.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <MaterialCommunityIcons
          name={isStripeRail ? 'credit-card-outline' : 'cellphone'}
          size={22}
          color={colors.primary.main}
        />
        <Text variant="titleSmall">{t('client.placeOrder.payment.title', 'Payment information')}</Text>
      </View>

      {isStripeRail ? (
        <View
          style={{
            padding: spacing.md,
            borderRadius: borderRadius.md,
            borderLeftWidth: 4,
            borderLeftColor: colors.info.main,
            backgroundColor: colors.surface,
          }}
        >
          <Text variant="titleSmall" style={{ marginBottom: spacing.xs }}>
            {t('client.placeOrder.payment.cardTitle', 'Pay securely by card')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
            {t(
              'client.placeOrder.payment.cardDescription',
              'A secure payment sheet will open when you place your order.'
            )}
          </Text>
          <View style={payStyles.trustRow}>
            <TrustBadge variant="encrypted_payments" label={t('checkout.payment.encrypted', 'Encrypted')} inline />
            <TrustBadge variant="secure_checkout" label={t('checkout.payment.secure', 'Secure checkout')} inline />
          </View>
        </View>
      ) : profileLoading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator />
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('client.placeOrder.payment.loadingProfile', 'Loading profile…')}
          </Text>
        </View>
      ) : profilePhone?.trim() ? (
        <>
          <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: 4 }}>
            {t('client.placeOrder.payment.paymentPhoneLabel', 'Payment phone number')}
          </Text>
          <Text variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.md }}>
            {useDifferentPhone ? overrideNationalDigits || '—' : profilePhone}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="bodyMedium" style={{ flex: 1, paddingRight: spacing.sm }}>
              {t('client.placeOrder.payment.useDifferentPhone', 'Use a different phone number')}
            </Text>
            <Switch value={useDifferentPhone} onValueChange={onToggleDifferentPhone} />
          </View>

          {useDifferentPhone ? (
            <>
              <Divider style={{ marginVertical: spacing.sm }} />
              <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
                {t('client.placeOrder.payment.overrideLabel', 'Phone number for payment')}
              </Text>
              <PhoneNumberInput
                countryIso={overrideCountryIso}
                nationalDigits={overrideNationalDigits}
                onCountryIsoChange={onOverrideCountryIsoChange}
                onNationalDigitsChange={onOverrideNationalDigitsChange}
                hasError={!!phoneInvalidReason}
                allowedIsos={['CM', 'GA']}
              />
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
                {t(
                  'client.placeOrder.payment.overrideNote',
                  'This number will receive the payment request for this order.'
                )}
              </Text>
            </>
          ) : null}

          {phoneInvalidReason ? (
            <Text style={{ color: colors.error.main, marginTop: spacing.sm }}>
              {phoneInvalidReason === 'unsupported' ? unsupportedMsg : invalidMsg}
            </Text>
          ) : null}
        </>
      ) : (
        <View
          style={{
            padding: spacing.md,
            borderRadius: borderRadius.md,
            borderLeftWidth: 4,
            borderLeftColor: colors.info.main,
            backgroundColor: colors.surface,
          }}
        >
          <Text variant="titleSmall" style={{ marginBottom: spacing.xs }}>
            {t('client.placeOrder.payment.mobileMoneyTitle', 'Mobile Money payment')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
            {t(
              'client.placeOrder.payment.addPhoneRequired',
              'Add a phone number to receive Mobile Money payment requests.'
            )}
          </Text>
          {onAddPhonePress ? (
            <Button
              mode="outlined"
              compact
              icon="phone-plus-outline"
              onPress={onAddPhonePress}
              style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
            >
              {t('client.placeOrder.payment.addPhone', 'Add phone number')}
            </Button>
          ) : null}
        </View>
      )}
    </View>
  );
}

const payStyles = StyleSheet.create({
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeSpacing.xs,
    marginTop: themeSpacing.xs,
  },
});
