import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { isCrossBorder } from '../../utils/diasporaCheckout';
import { getCountryDisplayName } from '../../utils/phoneCountryOptions';
import type { CheckoutDiaspora } from '../../types/checkout';

export interface DiasporaCheckoutBannerProps {
  diaspora: CheckoutDiaspora | null | undefined;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Header for diaspora checkout: labels the mode and shows paying-from / delivering-to.
 * Someone else always receives diaspora orders — no opt-in switch.
 */
export function DiasporaCheckoutBanner({
  diaspora,
  style,
}: DiasporaCheckoutBannerProps) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing, shadows } = useTheme();

  if (!diaspora?.is_diaspora) return null;

  const crossBorder = isCrossBorder(diaspora);
  const payerCountry = diaspora.payer_country?.trim().toUpperCase();
  const fulfillmentCountry = diaspora.fulfillment_country?.trim().toUpperCase();
  const locale = i18n.language || 'en';

  return (
    <View
      style={[
        styles.container,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderColor: colors.primary.main,
          padding: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
      accessibilityRole="header"
      accessibilityLabel={t('diaspora.checkoutHeader', 'Diaspora checkout')}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
          <MaterialCommunityIcons
            name="airplane-takeoff"
            size={20}
            color={colors.primary.main}
          />
        </View>
        <View style={styles.textCol}>
          <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {t('diaspora.checkoutHeader', 'Diaspora checkout')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('diaspora.bannerTitle', 'Sending an order home')}
          </Text>
          {crossBorder && payerCountry && fulfillmentCountry ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('diaspora.payingFrom', 'Paying from {{country}}', {
                country: getCountryDisplayName(locale, payerCountry),
              })}
              {' · '}
              {t('diaspora.deliveringTo', 'Delivering to {{country}}', {
                country: getCountryDisplayName(locale, fulfillmentCountry),
              })}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 },
});
