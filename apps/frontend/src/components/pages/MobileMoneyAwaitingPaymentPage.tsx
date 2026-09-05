import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { MobileMoneyConfirmIllustration } from '../illustrations/MobileMoneyConfirmIllustration';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import { useMobileMoneyPaymentPoll } from '../../hooks/useMobileMoneyPaymentPoll';
import { maskPhoneE164 } from '../../utils/maskPhoneE164';
import {
  parseMomoAwaitingPaymentParams,
  type MobileMoneyAwaitingPaymentState,
} from '../../utils/momoAwaitingPaymentNav';

export type { MobileMoneyAwaitingPaymentState };

const MobileMoneyAwaitingPaymentPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const backendOrders = useBackendOrders();
  const params = useMemo(
    () =>
      parseMomoAwaitingPaymentParams(
        location.search,
        (location.state || null) as Partial<MobileMoneyAwaitingPaymentState> | null
      ),
    [location.search, location.state]
  );
  const orderIds = params.orderIds;
  const phoneE164 = params.phoneE164;
  const source = params.source;
  const confirmationState = params.confirmationState;

  const { state, error, stop, restart } = useMobileMoneyPaymentPoll(orderIds);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const masked = useMemo(() => maskPhoneE164(phoneE164), [phoneE164]);

  const leaveToOrder = () => {
    stop();
    const firstId = orderIds[0];
    if (firstId) {
      navigate(`/orders/${firstId}`);
      return;
    }
    navigate('/orders');
  };

  const onContinueAfterPaid = () => {
    stop();
    if (source === 'checkout' && confirmationState) {
      navigate('/orders/confirmation', { state: confirmationState, replace: true });
      return;
    }
    leaveToOrder();
  };

  const onRetry = async () => {
    if (!orderIds.length) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const phone = phoneE164.trim() || undefined;
      await Promise.all(
        orderIds.map((id) =>
          source === 'pickup'
            ? backendOrders.initiatePayAtPickupPayment(id, phone)
            : backendOrders.retryOrderPayment(id)
        )
      );
      restart();
    } catch (e: any) {
      setRetryError(
        e?.message ||
          t('orders.momoAwaiting.retryError', 'Could not send another payment request.')
      );
    } finally {
      setRetrying(false);
    }
  };

  if (!orderIds.length) {
    return (
      <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          {t('orders.orderNotFound', 'Order not found')}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/orders')}>
          {t('orders.momoAwaiting.back', 'Back to order')}
        </Button>
      </Container>
    );
  }

  const phase = state.phase;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        {phase === 'waiting' ? <MobileMoneyConfirmIllustration /> : null}
        {phase === 'paid' ? (
          <CheckCircleOutline sx={{ fontSize: 72, color: 'success.main' }} />
        ) : null}
        {phase === 'failed' ? (
          <ErrorOutline sx={{ fontSize: 72, color: 'error.main' }} />
        ) : null}
        {phase === 'timeout' ? (
          <ScheduleOutlined sx={{ fontSize: 72, color: 'warning.main' }} />
        ) : null}

        <Typography
          variant="h5"
          sx={{
            mt: 2,
            fontWeight: 700,
            color:
              phase === 'paid'
                ? 'success.main'
                : phase === 'failed'
                  ? 'error.main'
                  : 'text.primary',
          }}
        >
          {phase === 'paid'
            ? t('orders.momoAwaiting.paidTitle', 'Payment confirmed')
            : phase === 'failed'
              ? t('orders.momoAwaiting.failedTitle', 'Payment failed')
              : phase === 'timeout'
                ? t('orders.momoAwaiting.timeoutTitle', 'Still waiting')
                : t('orders.momoAwaiting.waitingTitle', 'Approve on your phone')}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
          {phase === 'paid'
            ? source === 'pickup'
              ? t(
                  'orders.momoAwaiting.paidBodyPickup',
                  'Your payment went through. You can collect your order at the store.'
                )
              : t(
                  'orders.momoAwaiting.paidBodyCheckout',
                  'Your payment went through. The merchant will confirm your order next.'
                )
            : phase === 'failed'
              ? t(
                  'orders.momoAwaiting.failedBody',
                  'The mobile money request did not succeed. You can try again or go back to your order.'
                )
              : phase === 'timeout'
                ? t(
                    'orders.momoAwaiting.timeoutBody',
                    'We have not seen the payment yet. You can leave — we will update the order when it arrives. Keep your phone nearby if you still need to approve.'
                  )
                : t(
                    'orders.momoAwaiting.waitingBody',
                    'A payment request was sent to {{phone}}. Open the prompt on that phone and approve it with your PIN.',
                    { phone: masked }
                  )}
        </Typography>

        {phase === 'waiting' ? (
          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              {t('orders.momoAwaiting.waitingHint', 'Waiting for payment to complete…')}
            </Typography>
          </Box>
        ) : null}

        {(error || retryError) && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            {retryError || error}
          </Typography>
        )}

        <Stack spacing={1.5} sx={{ mt: 4 }}>
          {phase === 'paid' ? (
            <Button variant="contained" size="large" onClick={onContinueAfterPaid}>
              {source === 'pickup'
                ? t('orders.momoAwaiting.viewOrder', 'View order')
                : t('orders.momoAwaiting.continue', 'Continue')}
            </Button>
          ) : null}
          {phase === 'failed' ? (
            <Button
              variant="contained"
              color="cta"
              size="large"
              disabled={retrying}
              onClick={() => void onRetry()}
            >
              {t('orders.momoAwaiting.retry', 'Try again')}
            </Button>
          ) : null}
          {phase !== 'paid' ? (
            <Button variant="text" onClick={leaveToOrder}>
              {t('orders.momoAwaiting.back', 'Back to order')}
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Container>
  );
};

export default MobileMoneyAwaitingPaymentPage;
