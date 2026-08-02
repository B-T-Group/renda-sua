import { Typography, type TypographyProps } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface MoneyDisplayProps {
  amount?: number | null;
  currency?: string | null;
  variant?: TypographyProps['variant'];
  color?: TypographyProps['color'];
  fontWeight?: TypographyProps['fontWeight'];
  sx?: TypographyProps['sx'];
  fallback?: string;
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale = 'en'
): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || ''}`.trim();
  }
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  currency,
  variant = 'body1',
  color,
  fontWeight = 600,
  sx,
  fallback = '—',
}) => {
  const { i18n } = useTranslation();
  const text =
    amount == null
      ? fallback
      : formatMoney(amount, currency, i18n.language || 'en');

  return (
    <Typography
      variant={variant}
      color={color}
      fontWeight={fontWeight}
      sx={sx}
      component="span"
    >
      {text}
    </Typography>
  );
};

export default MoneyDisplay;
