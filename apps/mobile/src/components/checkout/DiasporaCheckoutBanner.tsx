import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { DiasporaGiftIllustration } from '../illustrations/DiasporaGiftIllustration';
import { isCrossBorder } from '../../utils/diasporaCheckout';
import { getCountryDisplayName } from '../../utils/phoneCountryOptions';
import type { CheckoutDiaspora } from '../../types/checkout';

export interface DiasporaCheckoutBannerProps {
  diaspora: CheckoutDiaspora | null | undefined;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Header for diaspora checkout. Someone else always receives the order.
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
  const title = t('diaspora.bannerTitle', 'Sending an order home');

  return (
    <View
      style={[
        styles.container,
        shadows.sm,
        {
          backgroundColor: colors.warningTint,
          borderRadius: borderRadius.card,
          borderColor: colors.warning.main,
          padding: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
      accessibilityRole="header"
      accessibilityLabel={title}
    >
      <View style={styles.row}>
        <DiasporaGiftIllustration
          label={t('diaspora.illustrationLabel', 'A gift for someone special')}
        />
        <View style={styles.textCol}>
          <View style={styles.eyebrowRow}>
            <MaterialCommunityIcons name="star" size={14} color={colors.warning.main} />
            <Text variant="labelMedium" style={{ color: colors.warning.dark, fontWeight: '700' }}>
              {t('diaspora.eyebrow', 'For someone special')}
            </Text>
          </View>
          <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {title}
          </Text>
          {crossBorder && payerCountry && fulfillmentCountry ? (
            <CountryRoute
              payerLabel={t('diaspora.payingFrom', 'Paying from {{country}}', {
                country: getCountryDisplayName(locale, payerCountry),
              })}
              deliverLabel={t('diaspora.deliveringTo', 'Delivering to {{country}}', {
                country: getCountryDisplayName(locale, fulfillmentCountry),
              })}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function CountryRoute({
  payerLabel,
  deliverLabel,
}: {
  payerLabel: string;
  deliverLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
      {payerLabel}
      <Text variant="bodySmall" style={{ color: colors.warning.dark }}>
        {'  →  '}
      </Text>
      {deliverLabel}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
