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
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

interface OrderConfirmationData {
  order?: {
    id: string;
    order_number: string;
    total_amount: number;
    currency: string;
    current_status: string;
    created_at: string;
    payment_transaction: {
      transaction_id: string;
      success: boolean;
      message: string;
    };
    database_transaction: {
      id: string;
      reference: string;
      status: string;
    };
  };
  orders?: Array<{
    id: string;
    order_number: string;
    total_amount: number;
    currency: string;
    current_status: string;
    created_at: string;
    payment_transaction: {
      transaction_id: string;
      success: boolean;
      message: string;
    };
    database_transaction: {
      id: string;
      reference: string;
      status: string;
    };
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
      </Box>

      {/* Payment Confirmation Alert */}
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

      {/* Payment Transaction Details */}
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
            <Phone
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
              {t('orders.paymentDetails', 'Payment Details')}
            </Typography>
          </Box>

          {isMultipleOrders ? (
            // Multiple Orders Payment Details
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
                            {t('orders.transactionId', 'Transaction ID')}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 'medium',
                              wordBreak: 'break-all',
                            }}
                          >
                            {order.payment_transaction?.transaction_id || 'N/A'}
                          </Typography>
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('orders.paymentStatus', 'Payment Status')}
                          </Typography>
                          <Chip
                            label={
                              order.payment_transaction?.success
                                ? t(
                                    'orders.paymentInitiated',
                                    'Payment Initiated'
                                  )
                                : t('orders.paymentFailed', 'Payment Failed')
                            }
                            color={
                              order.payment_transaction?.success
                                ? 'success'
                                : 'error'
                            }
                            size="small"
                          />
                        </Box>
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Box sx={{ mb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t(
                              'orders.databaseTransactionId',
                              'Database Transaction ID'
                            )}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 'medium',
                              wordBreak: 'break-all',
                            }}
                          >
                            {order.database_transaction?.id || 'N/A'}
                          </Typography>
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t(
                              'orders.databaseTransactionStatus',
                              'Database Transaction Status'
                            )}
                          </Typography>
                          <Chip
                            label={order.database_transaction?.status || 'N/A'}
                            color="info"
                            size="small"
                          />
                        </Box>
                      </Grid>
                    </Grid>

                    {order.payment_transaction?.message && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          {t('orders.paymentMessage', 'Payment Message')}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontStyle: 'italic' }}
                        >
                          {order.payment_transaction.message}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            // Single Order Payment Details
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('orders.transactionId', 'Transaction ID')}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 'medium',
                      wordBreak: 'break-all',
                    }}
                  >
                    {orders[0].payment_transaction?.transaction_id || 'N/A'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('orders.paymentStatus', 'Payment Status')}
                  </Typography>
                  <Chip
                    label={
                      orders[0].payment_transaction?.success
                        ? t('orders.paymentInitiated', 'Payment Initiated')
                        : t('orders.paymentFailed', 'Payment Failed')
                    }
                    color={
                      orders[0].payment_transaction?.success
                        ? 'success'
                        : 'error'
                    }
                    size="small"
                  />
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t(
                      'orders.databaseTransactionId',
                      'Database Transaction ID'
                    )}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 'medium',
                      wordBreak: 'break-all',
                    }}
                  >
                    {orders[0].database_transaction?.id || 'N/A'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t(
                      'orders.databaseTransactionStatus',
                      'Database Transaction Status'
                    )}
                  </Typography>
                  <Chip
                    label={orders[0].database_transaction?.status || 'N/A'}
                    color="info"
                    size="small"
                  />
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Show payment message for single order */}
          {!isMultipleOrders && orders[0].payment_transaction?.message && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('orders.paymentMessage', 'Payment Message')}
              </Typography>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                {orders[0].payment_transaction.message}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Schedule sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {t('orders.nextSteps', 'Next Steps')}
            </Typography>
          </Box>

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
          variant="outlined"
          onClick={handleViewOrders}
          size="large"
          sx={{
            maxWidth: { xs: '100%', sm: '200px' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          {t('orders.viewMyOrders', 'View My Orders')}
        </Button>
        <Button
          variant="contained"
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
