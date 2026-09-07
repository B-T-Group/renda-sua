import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { getCountryDisplayName } from '@/utils/phoneCountryOptions';

export interface PaymentMethodLockedRowProps {
  /** Payment method type (e.g., 'mobile_money' or 'stripe') */
  method: 'mobile_money' | 'stripe';
  /** Country ISO code for context (e.g., 'CM', 'GA') - used to display country name */
  countryIso?: string;
  /** Whether this is a locked row (not user-selectable) */
  locked?: boolean;
}

/**
 * Single locked payment method row showing the payment method determined by the server
 * via preflight checkout config.
 * 
 * CRITICAL: Do NOT drive this component from client-side country logic alone.
 * The payment rail is determined by the server based on:
 * - Payer country (buyer_rail)
 * - Seller country and payment setup
 * - Diaspora status (CA/US payer → CM merchant)
 * - Available payment timings and methods
 * 
 * Examples:
 * - Local CM→CM: "MoMo · Cameroon" (locked)
 * - Local GA→GA: "MoMo · Gabon" (locked)
 * - Diaspora CA/US→CM: "Card payment" (locked, no country suffix)
 * - CA seller: "Card payment" or "Credit Card" (locked, no country suffix)
 * 
 * Displays "MoMo · Gabon · Based on your country" for local MoMo
 * or "Card payment · Based on your country" for Stripe.
 */
export function PaymentMethodLockedRow({
  method,
  countryIso,
  locked = true,
}: PaymentMethodLockedRowProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  
  const countryDisplayName = countryIso ? getCountryDisplayName(i18n.language, countryIso) : undefined;

  const icon = method === 'mobile_money' ? 'cellphone' : 'credit-card-outline';
  const label = method === 'mobile_money' 
    ? 'MoMo'
    : t('checkout.payment.cardPayment', 'Card payment');
  const iconBgColor = method === 'mobile_money' ? '#FFC107' : colors.primary.main;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary.main,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: iconBgColor,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={method === 'mobile_money' ? 'wallet' : icon}
            size={20}
            color={method === 'mobile_money' ? '#000' : '#fff'}
          />
        </View>

        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <View style={styles.labelRow}>
            <Text
              variant="titleSmall"
              style={[typography.subtitle2, { color: colors.text.primary, fontWeight: '600' }]}
            >
              {label}
            </Text>
            {countryDisplayName ? (
              <>
                <Text style={[typography.body2, { color: colors.text.secondary }]}> · </Text>
                <Text style={[typography.body2, { color: colors.text.secondary }]}>{countryDisplayName}</Text>
              </>
            ) : null}
          </View>
          {locked ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
              {t('checkout.payment.basedOnCountry', 'Based on your country')}
            </Text>
          ) : null}
        </View>

        {locked ? (
          <MaterialCommunityIcons name="lock" size={20} color={colors.primary.main} />
        ) : (
          <MaterialCommunityIcons name="check-circle" size={20} color={colors.success.main} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
