import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStripePayments } from '../../hooks/useStripePayments';

const StripePaymentSuccessPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkStatusByReference } = useStripePayments();

  const reference = searchParams.get('reference') ?? '';
  const orderNumber = searchParams.get('order') ?? '';
  const bookingId = searchParams.get('booking') ?? '';
  const bookingNumber = searchParams.get('bookingNumber') ?? '';
  const isRental = Boolean(bookingId || bookingNumber);

  useEffect(() => {
    if (reference) {
      void checkStatusByReference(reference);
    }
  }, [reference, checkStatusByReference]);

  const primaryHref = bookingId
    ? `/rentals/bookings/${bookingId}`
    : orderNumber
      ? '/orders'
      : isRental
        ? '/rentals/requests'
        : '/orders';

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <CheckCircleIcon color="success" sx={{ fontSize: 72 }} />

          <Typography variant="h5">
            {isRental
              ? t('stripe.success.rentalTitle', 'Payment received')
              : t('stripe.success.title', 'Card authorized')}
          </Typography>

          <Typography variant="body1" color="text.secondary">
            {isRental
              ? t(
                  'stripe.success.rentalBody',
                  'Your rental payment was received. Your booking will be confirmed shortly — you can view it below.'
                )
              : t(
                  'stripe.success.body',
                  'Your card has been authorized. You will only be charged when the delivery agent picks up your order from the business.'
                )}
          </Typography>

          {orderNumber && !isRental ? (
            <Typography variant="body2" color="text.secondary">
              {t('stripe.success.orderReference', 'Order #{{orderNumber}}', {
                orderNumber,
              })}
            </Typography>
          ) : null}

          {bookingNumber ? (
            <Typography variant="body2" color="text.secondary">
              {t(
                'stripe.success.bookingReference',
                'Booking #{{bookingNumber}}',
                { bookingNumber }
              )}
            </Typography>
          ) : null}

          <Box>
            <Button variant="contained" onClick={() => navigate(primaryHref)}>
              {isRental
                ? t('stripe.success.viewBooking', 'View booking')
                : t('stripe.success.viewOrders', 'View my orders')}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default StripePaymentSuccessPage;
