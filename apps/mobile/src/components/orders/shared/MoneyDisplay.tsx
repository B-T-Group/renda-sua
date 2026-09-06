import { Text, type TextProps } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../utils/formatters';

export interface MoneyDisplayProps {
  amount?: number | null;
  currency?: string | null;
  variant?: TextProps['variant'];
  style?: TextProps['style'];
  fallback?: string;
}

export function MoneyDisplay({
  amount,
  currency,
  variant = 'bodyMedium',
  style,
  fallback = '—',
}: MoneyDisplayProps) {
  const { i18n } = useTranslation();
  const text =
    amount == null
      ? fallback
      : formatCurrency(amount, currency, i18n.language || 'en');

  return (
    <Text variant={variant} style={[{ fontWeight: '600' }, style]}>
      {text}
    </Text>
  );
}
