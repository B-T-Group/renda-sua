import {
  Add,
  ArrowBack,
  Delete,
  Remove,
  ShoppingCart,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Divider,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

const CartPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    getCartByBusiness,
    getCartTotal,
  } = useCart();

  const cartByBusiness = getCartByBusiness();
  const cartTotal = getCartTotal();

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleProceedToCheckout = () => {
    navigate('/checkout');
  };

  const handleContinueShopping = () => {
    navigate('/items');
  };

  if (cartItems.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ShoppingCart sx={{ fontSize: 80, color: 'grey.400', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            {t('cart.empty', 'Your cart is empty')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {t('cart.emptyDescription', 'Add some items to get started')}
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleContinueShopping}
          >
            {t('cart.continueShopping', 'Continue Shopping')}
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {t('cart.title', 'Shopping Cart')}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3,
        }}
      >
        {/* Cart Items */}
        <Box sx={{ flex: { xs: '1', lg: '2' } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t('cart.items', 'Items')} ({cartItems.length})
          </Typography>

          {Array.from(cartByBusiness.entries()).map(([businessId, items]) => (
            <Box key={businessId} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                {t('cart.businessOrders', 'Orders by Business')}
              </Typography>

              {items.map((item) => (
                <Card key={item.inventoryItemId} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {/* Item Image */}
                      <CardMedia
                        component="img"
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: 1,
                          objectFit: 'cover',
                        }}
                        image={
                          item.itemData.imageUrl || '/placeholder-item.jpg'
                        }
                        alt={item.itemData.name}
                      />

                      {/* Item Details */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {item.itemData.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                        >
                          {formatCurrency(
                            item.itemData.price,
                            item.itemData.currency
                          )}{' '}
                          each
                        </Typography>

                        {/* Quantity Controls */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                updateQuantity(
                                  item.inventoryItemId,
                                  item.quantity - 1
                                )
                              }
                              disabled={item.quantity <= 1}
                            >
                              <Remove />
                            </IconButton>
                            <Typography
                              variant="body1"
                              sx={{ minWidth: 20, textAlign: 'center' }}
                            >
                              {item.quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() =>
                                updateQuantity(
                                  item.inventoryItemId,
                                  item.quantity + 1
                                )
                              }
                            >
                              <Add />
                            </IconButton>
                          </Box>

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography variant="h6" color="primary">
                              {formatCurrency(
                                item.itemData.price * item.quantity,
                                item.itemData.currency
                              )}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() =>
                                removeFromCart(item.inventoryItemId)
                              }
                              color="error"
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ))}
        </Box>

        {/* Cart Summary */}
        <Box sx={{ flex: { xs: '1', lg: '1' } }}>
          <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('cart.orderSummary', 'Order Summary')}
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="body2">
                  {t('cart.subtotal', 'Subtotal')} ({t('cart.itemCount', '{{count}} item(s)', { count: cartItems.length })})
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(Number(cartTotal) || 0)}
                </Typography>
              </Box>

              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="body2">
                  {t('cart.deliveryFee', 'Delivery Fee')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('cart.calculatedAtCheckout', 'Calculated at checkout')}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}
            >
              <Typography variant="h6">{t('cart.total', 'Total')}</Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(Number(cartTotal) || 0)}
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

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleProceedToCheckout}
              sx={{ mb: 2 }}
            >
              {t('cart.proceedToCheckout', 'Proceed to Checkout')}
            </Button>

            <Button
              variant="outlined"
              fullWidth
              onClick={handleContinueShopping}
            >
              {t('cart.continueShopping', 'Continue Shopping')}
            </Button>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
};

export default CartPage;
