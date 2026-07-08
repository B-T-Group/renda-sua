import { Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface CheckoutTaxSummaryLinesProps {
  show: boolean;
  /** Translation namespace prefix: orders | checkout | cart */
  namespace?: 'orders' | 'checkout' | 'cart';
}

export const CheckoutTaxSummaryLines: React.FC<CheckoutTaxSummaryLinesProps> = ({
  show,
  namespace = 'orders',
}) => {
  const { t } = useTranslation();

  if (!show) return null;

  const taxLabel =
    namespace === 'orders'
      ? t('orders.tax', 'Tax')
      : namespace === 'cart'
        ? t('orders.tax', 'Tax')
        : t('orders.tax', 'Tax');

  const taxValue =
    namespace === 'orders'
      ? t('orders.taxCalculatedAtCheckout', 'Calculated at checkout')
      : namespace === 'cart'
        ? t('cart.taxCalculatedAtCheckout', 'Calculated at checkout')
        : t('checkout.taxCalculatedAtCheckout', 'Calculated at checkout');

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {taxLabel}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {taxValue}
      </Typography>
    </Box>
  );
};

export function checkoutTotalLabelKey(
  showBeforeTax: boolean,
  namespace: 'orders' | 'checkout' | 'cart' = 'orders'
): string {
  if (!showBeforeTax) {
    return namespace === 'cart' ? 'cart.total' : `${namespace}.total`;
  }
  return namespace === 'cart'
    ? 'cart.totalBeforeTax'
    : `${namespace}.totalBeforeTax`;
}

export function checkoutTotalLabelDefault(
  showBeforeTax: boolean,
  namespace: 'orders' | 'checkout' | 'cart' = 'orders'
): string {
  if (!showBeforeTax) return 'Total';
  return 'Total (before tax)';
}
