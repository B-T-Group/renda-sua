import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/utils/formatters';
import { AppText } from './AppText';

type Props = {
  amount: number;
  currency?: string | null;
  compareAt?: number | null;
  size?: 'md' | 'lg';
  locale?: string;
};

/** Price, optional previous price, and the discount it implies. */
export function PriceText({ amount, currency, compareAt, size = 'md', locale }: Props) {
  const { colors, spacing } = useTheme();
  const formatted = formatCurrency(amount, currency, locale);
  const showCompare = compareAt != null && compareAt > amount;
  const discount = showCompare ? Math.round((1 - amount / compareAt) * 100) : 0;

  return (
    <View style={styles.row}>
      <AppText role={size === 'lg' ? 'priceLarge' : 'price'}>{formatted}</AppText>
      {showCompare ? (
        <AppText role="bodySmall" style={[styles.compare, { marginLeft: spacing.xs, color: colors.text.muted }]}>
          {formatCurrency(compareAt, currency, locale)}
        </AppText>
      ) : null}
      {discount > 0 ? (
        <AppText role="label" style={{ marginLeft: spacing.xs, color: colors.success.main }}>
          {`-${discount}%`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  compare: { textDecorationLine: 'line-through' },
});
