import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import {
  itemPaymentMarks,
  type PaymentMark,
  type PaymentRail,
} from '@/utils/itemPaymentMarks';

export interface PaymentMethodLockedRowProps {
  /** Server rail from checkout preflight. */
  method: PaymentRail;
  /** Seller countries of the items being checked out. */
  countryIsos?: Array<string | null | undefined>;
}

const BRAND_LOGOS: Record<
  'cm' | 'airtel' | 'moov',
  { source: ImageSourcePropType; width: number; height: number }
> = {
  cm: {
    source: require('../../../assets/payments/cm-mobile-money.png'),
    width: 120,
    height: 55,
  },
  airtel: {
    source: require('../../../assets/payments/airtel-money.png'),
    width: 48,
    height: 48,
  },
  moov: {
    source: require('../../../assets/payments/moov-money.png'),
    width: 48,
    height: 48,
  },
};

const MARK_LABEL_KEYS: Record<PaymentMark, { key: string; fallback: string }> = {
  cm: {
    key: 'checkout.payment.cmMobileMoney',
    fallback: 'MTN MoMo and Orange Money',
  },
  airtel: { key: 'checkout.payment.airtelMoney', fallback: 'Airtel Money' },
  moov: { key: 'checkout.payment.moovMoney', fallback: 'Moov Money' },
  card: { key: 'checkout.payment.card', fallback: 'Card' },
  generic: { key: 'checkout.payment.genericMobileMoney', fallback: 'Mobile money' },
};

/**
 * Shows the payment marks supported for the items' country.
 * Cameroon: one image with MTN MoMo and Orange Money. Gabon: Airtel and Moov. Stripe: card.
 */
export function PaymentMethodLockedRow({
  method,
  countryIsos,
}: PaymentMethodLockedRowProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const marks = itemPaymentMarks({ method, countryIsos });
  const label = marks.map((mark) => markLabel(t, mark)).join(', ');

  if (marks[0] === 'generic') {
    return <GenericPaymentMark label={label} />;
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.row, { gap: spacing.sm }]}
    >
      {marks.map((mark) =>
        mark === 'generic' ? null : <PaymentMarkView key={mark} mark={mark} />
      )}
    </View>
  );
}

function markLabel(
  t: (key: string, fallback: string) => string,
  mark: PaymentMark
): string {
  const copy = MARK_LABEL_KEYS[mark];
  return t(copy.key, copy.fallback);
}

function PaymentMarkView({ mark }: { mark: Exclude<PaymentMark, 'generic'> }) {
  if (mark === 'card') return <CardMark />;
  return <BrandLogo mark={mark} />;
}

function BrandLogo({ mark }: { mark: 'cm' | 'airtel' | 'moov' }) {
  const { t } = useTranslation();
  const logo = BRAND_LOGOS[mark];
  return (
    <Image
      source={logo.source}
      accessibilityLabel={markLabel(t, mark)}
      resizeMode="contain"
      style={[styles.logo, { width: logo.width, height: logo.height }]}
    />
  );
}

function CardMark() {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={markLabel(t, 'card')}
      style={[
        styles.cardChip,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      <Svg width={28} height={20} viewBox="0 0 28 20">
        <Rect width="28" height="20" rx="3" fill={colors.primary.main} />
        <Rect y="5" width="28" height="4" fill="#FFFFFF" opacity={0.9} />
        <Rect x="3" y="12" width="8" height="3" rx="1" fill="#FFFFFF" />
      </Svg>
      <Text variant="labelLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {markLabel(t, 'card')}
      </Text>
    </View>
  );
}

function GenericPaymentMark({ label }: { label: string }) {
  const { colors, borderRadius, spacing } = useTheme();
  return (
    <View
      accessibilityRole="text"
      style={[
        styles.generic,
        {
          gap: spacing.sm,
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      <MaterialCommunityIcons name="cellphone" size={22} color={colors.text.secondary} />
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    borderRadius: 8,
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  generic: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
});
