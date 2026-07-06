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

  // Fire-and-forget status sync so the backend reconciles quickly even before
  // the webhook lands; the page always presents success regardless of result.
  useEffect(() => {
    if (reference) {
      void checkStatusByReference(reference);
    }
  }, [reference, checkStatusByReference]);

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <CheckCircleIcon color="success" sx={{ fontSize: 72 }} />

          <Typography variant="h5">
            {t('stripe.success.title', 'Card authorized')}
          </Typography>

          <Typography variant="body1" color="text.secondary">
            {t(
              'stripe.success.body',
              'Your card has been authorized. You will only be charged after the business confirms your order and a delivery agent is assigned.'
            )}
          </Typography>

          {orderNumber && (
            <Typography variant="body2" color="text.secondary">
              {t('stripe.success.orderReference', 'Order #{{orderNumber}}', {
                orderNumber,
              })}
            </Typography>
          )}

          <Box>
            <Button variant="contained" onClick={() => navigate('/orders')}>
              {t('stripe.success.viewOrders', 'View my orders')}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default StripePaymentSuccessPage;
