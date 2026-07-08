import {
  Box,
  Button,
  Divider,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useCheckoutPreflight } from '../../hooks/useCheckoutPreflight';
import {
  CheckoutTaxSummaryLines,
  checkoutTotalLabelDefault,
  checkoutTotalLabelKey,
} from '../common/CheckoutTaxSummaryLines';

interface CartSummaryProps {
  showCheckoutButton?: boolean;
  compact?: boolean;
}

const CartSummarySkeleton: React.FC = () => (
  <Paper sx={{ p: 3 }}>
    <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="60%" height={20} sx={{ mb: 1 }} />
    <Skeleton variant="text" width="50%" height={20} sx={{ mb: 2 }} />
    <Divider sx={{ my: 2 }} />
    <Skeleton variant="text" width="70%" height={24} sx={{ mb: 2 }} />
    <Skeleton variant="rectangular" width="100%" height={40} />
  </Paper>
);

const CartSummary: React.FC<CartSummaryProps> = ({
  showCheckoutButton = true,
  compact = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cartItems, getCartTotal, getCartByBusiness } = useCart();

  const cartTotal = getCartTotal();
  const cartByBusiness = getCartByBusiness();

  const checkoutPreflightRequest = useMemo(() => {
    if (cartItems.length === 0) return null;
    return {
      items: cartItems.map((item) => ({
        business_inventory_id: item.inventoryItemId,
        quantity: item.quantity,
        ...(item.variantId ? { item_variant_id: item.variantId } : {}),
      })),
      payment_timing: 'pay_now' as const,
    };
  }, [cartItems]);

  const checkoutPreflight = useCheckoutPreflight(
    checkoutPreflightRequest,
    cartItems.length > 0
  );

  const showTaxAtCheckoutNotice =
    checkoutPreflight?.tax_notice === 'calculated_at_checkout';

  // Get currency from cart items (all items should have the same currency)
  const currency = cartItems.length > 0 ? cartItems[0].itemData.currency : 'USD';

  const formatCurrency = (amount: number, currencyCode: string = currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  };

  const handleProceedToCheckout = () => {
    navigate('/checkout');
  };

  const handleViewCart = () => {
    navigate('/cart');
  };

  if (cartItems.length === 0) {
    return (
      <Paper sx={{ p: compact ? 2 : 3 }}>
        <Typography variant={compact ? 'body1' : 'h6'} sx={{ mb: 2 }}>
          {t('cart.title', 'Shopping Cart')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('cart.empty', 'Your cart is empty')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: compact ? 2 : 3 }}>
      <Typography variant={compact ? 'body1' : 'h6'} sx={{ mb: 2 }}>
        {t('cart.orderSummary', 'Order Summary')}
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">
            {t('cart.subtotal', 'Subtotal')} ({t('cart.itemCount', '{{count}} item(s)', { count: cartItems.length })})
          </Typography>
          <Typography variant="body2">{formatCurrency(cartTotal)}</Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">
            {t('cart.deliveryFee', 'Delivery Fee')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('cart.calculatedAtCheckout', 'Calculated at checkout')}
          </Typography>
        </Box>
      </Box>

      <CheckoutTaxSummaryLines show={showTaxAtCheckoutNotice} namespace="cart" />

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={compact ? 'body1' : 'h6'}>
          {t(
            checkoutTotalLabelKey(showTaxAtCheckoutNotice, 'cart'),
            checkoutTotalLabelDefault(showTaxAtCheckoutNotice, 'cart')
          )}
        </Typography>
        <Typography variant={compact ? 'body1' : 'h6'} color="primary">
          {formatCurrency(cartTotal)}
        </Typography>
      </Box>

      {cartByBusiness.size > 1 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'cart.multipleOrdersNotice',
            'Your items will be split into {{count}} separate orders',
            { count: cartByBusiness.size }
          )}
        </Typography>
      )}

      {showCheckoutButton && (
        <Button
          variant="contained"
          fullWidth
          size={compact ? 'medium' : 'large'}
          onClick={handleProceedToCheckout}
          sx={{ mb: compact ? 1 : 2 }}
        >
          {t('cart.proceedToCheckout', 'Proceed to Checkout')}
        </Button>
      )}

      {!compact && (
        <Button variant="outlined" fullWidth onClick={handleViewCart}>
          {t('cart.viewCart', 'View Cart')}
        </Button>
      )}
    </Paper>
  );
};

export default CartSummary;
