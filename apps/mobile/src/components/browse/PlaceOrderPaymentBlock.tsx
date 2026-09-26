import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator,
  Button,
  Text,
} from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { TrustBadge } from '../common/TrustBadge';
import { StatusPill } from '../common/StatusPill';
import { spacing as themeSpacing } from '../../theme/spacing';
import type { MobilePaymentPhone } from '../../types/mobilePaymentPhone';

export interface PlaceOrderPaymentBlockProps {
  /** When true the client pays by card via Stripe; Mobile Money UI is hidden. */
  isStripeRail?: boolean;
  profileLoading: boolean;
  profilePhone: string | null | undefined;
  linkedPhone: MobilePaymentPhone | null;
  onChangePhonePress: () => void;
  onLinkProfilePress?: () => void;
  linkingBusy?: boolean;
}

/** Payment method + linked Mobile Money number. */
export function PlaceOrderPaymentBlock({
  isStripeRail = false,
  profileLoading,
  profilePhone,
  linkedPhone,
  onChangePhonePress,
  onLinkProfilePress,
  linkingBusy = false,
}: PlaceOrderPaymentBlockProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

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
            borderLeftColor: colors.primary.main,
            backgroundColor: colors.background.default,
            marginBottom: spacing.sm,
          }}
        >
          <Text variant="titleSmall" style={{ marginBottom: spacing.xs }}>
            {t('client.placeOrder.payment.cardTitle', 'Pay by card')}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t(
              'client.placeOrder.payment.cardBody',
              'You’ll complete payment securely with your card after placing the order.'
            )}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
            {t('checkout.momoPhoneHelper', 'Must match your MoMo number')}
          </Text>
          {profileLoading ? (
            <ActivityIndicator />
          ) : linkedPhone ? (
            <View
              style={{
                padding: spacing.md,
                borderRadius: borderRadius.md,
                backgroundColor: colors.background.default,
                borderWidth: 1,
                borderColor: colors.primary.main,
                marginBottom: spacing.sm,
              }}
            >
              <Text variant="titleSmall">{linkedPhone.phone_e164}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                <StatusPill
                  compact
                  label={
                    linkedPhone.is_verified
                      ? t('mobilePaymentPhone.verified', 'Verified')
                      : t('mobilePaymentPhone.unverified', 'Not verified')
                  }
                  backgroundColor={
                    linkedPhone.is_verified
                      ? `${colors.success.main}24`
                      : `${colors.warning.main}24`
                  }
                  textColor={
                    linkedPhone.is_verified ? colors.success.dark : colors.warning.dark
                  }
                />
              </View>
              <Button mode="outlined" style={{ marginTop: spacing.sm }} onPress={onChangePhonePress}>
                {t('common.change', 'Change')}
              </Button>
            </View>
          ) : (
            <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
              <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                {t(
                  'checkout.linkMoMoRequired',
                  'Link a Mobile Money number to continue.'
                )}
              </Text>
              {profilePhone?.trim() && onLinkProfilePress ? (
                <Button
                  mode="contained"
                  loading={linkingBusy}
                  disabled={linkingBusy}
                  onPress={onLinkProfilePress}
                >
                  {t('mobilePaymentPhone.useProfilePhone', 'Use {{phone}} for Mobile Money', {
                    phone: profilePhone,
                  })}
                </Button>
              ) : null}
              <Button
                mode={profilePhone?.trim() ? 'outlined' : 'contained'}
                onPress={onChangePhonePress}
              >
                {t('mobilePaymentPhone.linkNumber', 'Link a Mobile Money number')}
              </Button>
            </View>
          )}
          <TrustBadge
            label={t(
              'client.placeOrder.payment.trust',
              'Payment is held until the store accepts'
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  unused: { margin: themeSpacing.xs },
});
