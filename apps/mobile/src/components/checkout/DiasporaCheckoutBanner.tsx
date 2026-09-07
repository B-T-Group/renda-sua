import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Switch, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { isCrossBorder } from '../../utils/diasporaCheckout';
import { getCountryDisplayName } from '../../utils/phoneCountryOptions';
import type { CheckoutDiaspora } from '../../types/checkout';

export interface DiasporaCheckoutBannerProps {
  diaspora: CheckoutDiaspora | null | undefined;
  someoneElseReceiving: boolean;
  onSomeoneElseChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Diaspora checkout banner with a switch to send the order to someone else.
 */
export function DiasporaCheckoutBanner({
  diaspora,
  someoneElseReceiving,
  onSomeoneElseChange,
  disabled,
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
          borderColor: someoneElseReceiving ? colors.primary.main : colors.divider,
          padding: spacing.md,
          gap: spacing.md,
        },
        style,
      ]}
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

      <View style={styles.switchRow}>
        <Pressable
          style={styles.switchLabel}
          onPress={() => {
            if (!disabled) onSomeoneElseChange(!someoneElseReceiving);
          }}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: someoneElseReceiving, disabled: !!disabled }}
          accessibilityLabel={t(
            'diaspora.someoneElseReceiving',
            'Someone else is receiving this order'
          )}
        >
          <Text variant="bodyMedium" style={{ color: colors.text.primary, fontWeight: '600' }}>
            {t('diaspora.someoneElseReceiving', 'Someone else is receiving this order')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t(
              'diaspora.someoneElseHelp',
              'Turn this on to choose who will receive the order. We will send them delivery updates.'
            )}
          </Text>
        </Pressable>
        <Switch
          value={someoneElseReceiving}
          onValueChange={onSomeoneElseChange}
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
