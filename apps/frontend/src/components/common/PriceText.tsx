import { Box, Typography } from '@mui/material';
import { formatMoney } from '../orders/shared/MoneyDisplay';

type Props = {
  amount: number;
  currency?: string | null;
  compareAt?: number | null;
  size?: 'md' | 'lg';
  locale?: string;
};

/** Price, previous price, and discount. Amounts use the tabular price role. */
export function PriceText({ amount, currency, compareAt, size = 'md', locale }: Props) {
  const showCompare = compareAt != null && compareAt > amount;
  const discount = showCompare ? Math.round((1 - amount / compareAt) * 100) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant={size === 'lg' ? 'priceLarge' : 'price'}>
        {formatMoney(amount, currency, locale)}
      </Typography>
      {showCompare ? (
        <Typography variant="bodySmall" sx={{ textDecoration: 'line-through' }}>
          {formatMoney(compareAt, currency, locale)}
        </Typography>
      ) : null}
      {discount > 0 ? (
        <Typography variant="label" sx={{ color: 'success.main' }}>{`-${discount}%`}</Typography>
      ) : null}
    </Box>
  );
}
