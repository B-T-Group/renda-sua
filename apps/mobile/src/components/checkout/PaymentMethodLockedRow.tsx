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
  const { colors, spacing } = useTheme();
  const marks = itemPaymentMarks({ method, countryIsos });
  const label = marks.map((mark) => markLabel(t, mark)).join(', ');
  const heading = t('checkout.paymentMethod', 'Payment method');

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${heading}. ${label}`}
      style={[styles.row, { gap: spacing.sm }]}
    >
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, flexShrink: 1 }}
      >
        {heading}
      </Text>
      <PaymentMarks marks={marks} label={label} />
    </View>
  );
}

function PaymentMarks({ marks, label }: { marks: PaymentMark[]; label: string }) {
  const { spacing } = useTheme();
  if (marks[0] === 'generic') return <GenericPaymentMark label={label} />;
  return (
    <View style={[styles.marks, { gap: spacing.xs }]}>
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
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={markLabel(t, 'card')}
      style={styles.cardChip}
    >
      <Svg width={22} height={16} viewBox="0 0 28 20">
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
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.generic, { gap: spacing.xs }]}>
      <MaterialCommunityIcons name="cellphone" size={18} color={colors.text.secondary} />
      <Text variant="labelLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marks: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  logo: {
    borderRadius: 8,
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generic: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
