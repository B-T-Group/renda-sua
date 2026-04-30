import {
  CheckCircle,
  Home,
  Phone,
  Receipt,
  Schedule,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

type PaymentSource =
  | 'wallet'
  | 'mobile_payment'
  | 'mobile_money'
  | 'credit_card';

interface OrderConfirmationData {
  order?: {
    id: string;
    order_number: string;
    total_amount: number;
    currency: string;
    current_status: string;
    created_at: string;
    payment_source?: PaymentSource;
    payment_timing?: 'pay_now' | 'pay_at_delivery';
    payment_transaction: {
      transaction_id: string | null;
      success: boolean;
      message: string;
      mode?: string;
    };
    database_transaction: {
      id: string;
      reference: string;
      status: string;
    } | null;
  };
  orders?: Array<{
    id: string;
    order_number: string;
    total_amount: number;
    currency: string;
    current_status: string;
    created_at: string;
    payment_source?: PaymentSource;
    payment_timing?: 'pay_now' | 'pay_at_delivery';
    payment_transaction: {
      transaction_id: string | null;
      success: boolean;
      message: string;
      mode?: string;
    };
    database_transaction: {
      id: string;
      reference: string;
      status: string;
    } | null;
  }>;
  multipleOrders?: boolean;
}

const OrderConfirmationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Get order data from navigation state
  const orderData = location.state as OrderConfirmationData;

  if (!orderData?.order && !orderData?.orders) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h5" gutterBottom>
            {t('orders.orderNotFound', 'Order not found')}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/dashboard')}
            startIcon={<Home />}
          >
            {t('common.goToDashboard', 'Go to Dashboard')}
          </Button>
        </Box>
      </Container>
    );
  }

  // Determine if we have single or multiple orders
  const isMultipleOrders =
    orderData.multipleOrders ||
    (orderData.orders && orderData.orders.length > 1);
  const orders = orderData.orders || (orderData.order ? [orderData.order] : []);
  const totalAmount = orders.reduce(
    (sum, order) => sum + order.total_amount,
    0
  );
  const currency = orders[0]?.currency || 'USD';

  // Wallet = paid from balance (no phone step). API uses mobile_money for MM; DB enum may use mobile_payment.
  const isWalletPayment = (src?: PaymentSource) => src === 'wallet';
  const hasPayAtDelivery = orders.some((o) => o.payment_timing === 'pay_at_delivery');
  const showMobilePaymentConfirmation = isMultipleOrders
    ? orders.some(
        (o) =>
          o.payment_timing !== 'pay_at_delivery' && !isWalletPayment(o.payment_source)
      )
    : orders[0]?.payment_timing !== 'pay_at_delivery' &&
      !isWalletPayment(orders[0]?.payment_source);

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleViewOrders = () => {
    navigate('/orders');
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      {/* Success Header */}
      <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
        <CheckCircle
          sx={{
            fontSize: { xs: 60, sm: 80 },
            color: 'success.main',
            mb: 2,
          }}
        />
        <Typography
          variant="h4"
          gutterBottom
          color="success.main"
          sx={{
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            lineHeight: 1.2,
          }}
        >
          {isMultipleOrders
            ? t(
                'orders.ordersPlacedSuccessfully',
                'Orders Placed Successfully!'
              )
            : t('orders.orderPlacedSuccessfully', 'Order Placed Successfully!')}
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
        >
          {isMultipleOrders ? (
            <>
              {t('orders.orderCount', '{{count}} Orders Placed', {
                count: orders.length,
              })}
              <br />
              {t('orders.totalAmount', 'Total Amount')}:{' '}
              {totalAmount.toLocaleString()} {currency}
            </>
          ) : (
            <>
              {t('orders.orderNumber', 'Order Number')}:{' '}
              {orders[0].order_number}
            </>
          )}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          flexWrap="wrap"
          sx={{ mt: 2, my: 2 }}
        >
          {hasPayAtDelivery ? (
            <Chip
              icon={<Schedule />}
              label={t('orders.payAtDelivery.confirmationTitle', 'Payment at delivery')}
              color="info"
              variant="outlined"
            />
          ) : showMobilePaymentConfirmation ? (
            <Chip
              icon={<Phone />}
              label={t(
                'orders.paymentConfirmationRequired',
                'Payment Confirmation Required'
              )}
              color="primary"
              variant="outlined"
            />
          ) : (
            <Chip
              icon={<CheckCircle />}
              label={t('orders.paidFromWalletTitle', 'Order confirmed and paid')}
              color="success"
              variant="outlined"
            />
          )}
          <Chip
            label={t('orders.trackInMyOrders', 'Track progress in My Orders')}
            variant="outlined"
          />
        </Stack>
      </Box>

      {/* Payment confirmation: pay-now mobile payments vs pay-at-delivery */}
      {showMobilePaymentConfirmation ? (
        <Card
          sx={{
            mb: { xs: 3, sm: 4 },
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(25, 118, 210, 0.3)',
            border: '1px solid #1565c0',
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 2,
                flexDirection: { xs: 'column', sm: 'row' },
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              <Phone
                sx={{
                  mr: { xs: 0, sm: 1 },
                  mb: { xs: 1, sm: 0 },
                  color: 'white',
                }}
              />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  color: 'white',
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                }}
              >
                {t(
                  'orders.paymentConfirmationRequired',
                  'Payment Confirmation Required'
                )}
              </Typography>
            </Box>
            <Typography
              variant="body1"
              sx={{ mb: 2, color: 'white', lineHeight: 1.6 }}
            >
              {t(
                'orders.paymentConfirmationMessage',
                'A payment request has been sent to your mobile phone. Please confirm the payment to complete your order.'
              )}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'medium',
                color: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {t(
                'orders.paymentConfirmationDeadline',
                'Your order will be transmitted to the merchant within 24 hours once payment is confirmed.'
              )}
            </Typography>
          </CardContent>
        </Card>
      ) : hasPayAtDelivery ? (
        <Card
          sx={{
            mb: { xs: 3, sm: 4 },
            bgcolor: 'info.50',
            border: '1px solid',
            borderColor: 'info.main',
            boxShadow: '0 4px 20px rgba(2, 136, 209, 0.12)',
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 2,
                flexDirection: { xs: 'column', sm: 'row' },
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              <Schedule
                sx={{
                  mr: { xs: 0, sm: 1 },
                  mb: { xs: 1, sm: 0 },
                  color: 'info.main',
                }}
              />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  color: 'info.dark',
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                }}
              >
                {t(
                  'orders.payAtDelivery.confirmationTitle',
                  'Payment at delivery'
                )}
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: 'info.dark', lineHeight: 1.6 }}>
              {t(
                'orders.payAtDelivery.confirmationMessage',
                'You chose pay at delivery. You will complete payment in the app when the agent arrives.'
              )}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card
          sx={{
            mb: { xs: 3, sm: 4 },
            bgcolor: 'success.50',
            border: '1px solid',
            borderColor: 'success.main',
            boxShadow: '0 4px 20px rgba(46, 125, 50, 0.15)',
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                color: 'success.dark',
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                textAlign: 'center',
              }}
            >
              {t(
                'orders.paidFromWalletTitle',
                'Order confirmed and paid'
              )}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mt: 1,
                color: 'text.secondary',
                lineHeight: 1.6,
                textAlign: 'center',
              }}
            >
              {t(
                'orders.paidFromWalletMessage',
                'Your order was paid from your Rendasua account. No further action is required.'
              )}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Order Details */}
      <Card sx={{ mb: { xs: 3, sm: 4 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 3,
              flexDirection: { xs: 'column', sm: 'row' },
              textAlign: { xs: 'center', sm: 'left' },
            }}
          >
            <Receipt
              sx={{
                mr: { xs: 0, sm: 1 },
                mb: { xs: 1, sm: 0 },
                color: 'primary.main',
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
              }}
            >
              {isMultipleOrders
                ? t('orders.ordersDetails', 'Orders Details')
                : t('orders.orderDetails', 'Order Details')}
            </Typography>
          </Box>

          {isMultipleOrders ? (
            // Multiple Orders Display
            <Box>
              {orders.map((order, index) => (
                <Card key={order.id} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ mb: 2, fontWeight: 'bold' }}
                    >
                      {t('orders.orderNumber', 'Order')} #{index + 1}:{' '}
                      {order.order_number}
                    </Typography>

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Box sx={{ mb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('orders.orderStatus', 'Status')}
                          </Typography>
                          <Chip
                            label={t(
                              `orders.status.${order.current_status}`,
                              order.current_status
                            )}
                            color="warning"
                            size="small"
                          />
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('orders.orderAmount', 'Amount')}
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{ fontWeight: 'medium' }}
                          >
                            {order.total_amount.toLocaleString()}{' '}
                            {order.currency}
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Box sx={{ mb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('orders.orderDate', 'Date')}
                          </Typography>
                          <Typography variant="body1">
                            {new Date(order.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('orders.orderTime', 'Time')}
                          </Typography>
                          <Typography variant="body1">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}

              {/* Total Summary */}
              <Card
                variant="outlined"
                sx={{ bgcolor: 'primary.50', borderColor: 'primary.200' }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {t('orders.totalAmount', 'Total Amount')}
                    </Typography>
                    <Typography
                      variant="h6"
                      color="primary.main"
                      sx={{ fontWeight: 'bold' }}
                    >
                      {totalAmount.toLocaleString()} {currency}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ) : (
            // Single Order Display
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('orders.orderNumber', 'Order Number')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {orders[0].order_number}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('orders.orderStatus', 'Order Status')}
                  </Typography>
                  <Chip
                    label={t(
                      `orders.status.${orders[0].current_status}`,
                      orders[0].current_status
                    )}
                    color="warning"
                    size="small"
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('orders.totalAmount', 'Total Amount')}
                  </Typography>
                  <Typography
                    variant="h6"
                    color="primary.main"
                    sx={{ fontWeight: 'bold' }}
                  >
                    {orders[0].total_amount.toLocaleString()}{' '}
                    {orders[0].currency}
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('orders.orderDate', 'Order Date')}
                  </Typography>
                  <Typography variant="body1">
                    {new Date(orders[0].created_at).toLocaleDateString()}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('orders.orderTime', 'Order Time')}
                  </Typography>
                  <Typography variant="body1">
                    {new Date(orders[0].created_at).toLocaleTimeString()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Next Steps: different copy for wallet vs mobile payment */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Schedule sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {t('orders.nextSteps', 'Next Steps')}
            </Typography>
          </Box>

          {showMobilePaymentConfirmation ? (
            <Box component="ol" sx={{ pl: 2 }}>
              <Box component="li" sx={{ mb: 2 }}>
                <Typography variant="body1">
                  {t(
                    'orders.step1',
                    'Check your mobile phone for a payment request notification'
                  )}
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 2 }}>
                <Typography variant="body1">
                  {t(
                    'orders.step2',
                    'Confirm the payment request to authorize the transaction'
                  )}
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 2 }}>
                <Typography variant="body1">
                  {t(
                    'orders.step3',
                    'Your order will be transmitted to the merchant within 24 hours'
                  )}
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body1">
                  {t(
                    'orders.step4',
                    'You will receive updates on your order status via email and in-app notifications'
                  )}
                </Typography>
              </Box>
            </Box>
          ) : hasPayAtDelivery ? (
            <Box component="ol" sx={{ pl: 2 }}>
              <Box component="li" sx={{ mb: 2 }}>
                <Typography variant="body1">
                  {t(
                    'orders.payAtDelivery.step1',
                    'Your order has been sent to the merchant.'
                  )}
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 2 }}>
                <Typography variant="body1">
                  {t(
                    'orders.payAtDelivery.step2',
                    'When the agent arrives, you will receive a mobile payment request in the app.'
                  )}
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body1">
                  {t(
                    'orders.payAtDelivery.step3',
                    'You will receive updates on your order status via email and in-app notifications. Track progress in My Orders.'
                  )}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box component="ol" sx={{ pl: 2 }}>
              <Box component="li" sx={{ mb: 2 }}>
                <Typography variant="body1">
                  {t(
                    'orders.walletStep1',
                    'Your order has been sent to the merchant'
                  )}
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body1">
                  {t(
                    'orders.walletStep2',
                    'You will receive updates on your order status via email and in-app notifications. Track progress in My Orders.'
                  )}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          px: { xs: 1, sm: 0 },
        }}
      >
        <Button
          variant="contained"
          onClick={handleViewOrders}
          startIcon={<Receipt />}
          size="large"
          sx={{
            maxWidth: { xs: '100%', sm: '200px' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          {t('orders.viewMyOrders', 'View My Orders')}
        </Button>
        <Button
          variant="outlined"
          onClick={handleGoToDashboard}
          startIcon={<Home />}
          size="large"
          sx={{
            maxWidth: { xs: '100%', sm: '200px' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          {t('common.goToDashboard', 'Go to Dashboard')}
        </Button>
      </Box>
    </Container>
  );
};

export default OrderConfirmationPage;
