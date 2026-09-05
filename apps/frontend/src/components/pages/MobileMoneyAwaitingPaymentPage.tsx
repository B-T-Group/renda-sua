import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import Edit from '@mui/icons-material/Edit';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import Lock from '@mui/icons-material/Lock';
import PhoneAndroid from '@mui/icons-material/PhoneAndroid';
import Refresh from '@mui/icons-material/Refresh';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import Wallet from '@mui/icons-material/Wallet';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PhoneInput from '../common/PhoneInput';
import { pickMobileMoneyDefaultCountry } from '../../utils/mobileMoneyCountry';
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
  const [editPhoneOpen, setEditPhoneOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
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

  const handleEditPhone = () => {
    setNewPhoneNumber(phoneE164);
    setEditPhoneOpen(true);
  };

  const handleSavePhone = () => {
    // In a real implementation, this would update the phone and retry
    // For now, just close the dialog
    setEditPhoneOpen(false);
    // TODO: Implement phone number update and retry logic
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
                  'We could not complete your payment via MoMo. Please check and try again.'
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

        {/* Tips to resolve - only show on failed */}
        {phase === 'failed' && (
          <Box
            sx={{
              mt: 3,
              p: 2.5,
              bgcolor: 'warning.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'warning.200',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('orders.momoAwaiting.tipsToResolve', 'Tips to resolve this')}
            </Typography>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Wallet sx={{ color: 'warning.main', fontSize: 20, flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {t('orders.momoAwaiting.checkBalance', 'Check your MoMo balance')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('orders.momoAwaiting.checkBalanceDesc', 'Top up your MoMo wallet and try again.')}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <PhoneAndroid sx={{ color: 'warning.main', fontSize: 20, flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {t('orders.momoAwaiting.confirmNumber', 'Confirm your phone number')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('orders.momoAwaiting.confirmNumberDesc', 'Make sure +237 6XX XXX XXX matches the number linked to your MoMo wallet.')}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Box>
        )}

        {phase === 'waiting' ? (
          <Box sx={{ mt: 3 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.hover',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                mb: 3,
              }}
            >
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                {t('orders.momoAwaiting.waitingHint', 'Waiting for payment to complete…')}
              </Typography>
            </Box>

            {/* Post-payment next steps */}
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'success.50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircleOutline sx={{ color: 'success.main', fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t('orders.momoAwaiting.step1Title', 'Store accepts')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('orders.momoAwaiting.step1Desc', 'Usually within 15 min')}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'primary.50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="caption" fontWeight="bold" color="primary.main">
                    2
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t('orders.momoAwaiting.step2Title', 'Preparing')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('orders.momoAwaiting.step2Desc', 'Store gets your order ready')}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="caption" fontWeight="bold" color="text.secondary">
                    3
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t('orders.momoAwaiting.step3Title', 'On the way')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('orders.momoAwaiting.step3Desc', 'Track your delivery in real time')}
                  </Typography>
                </Box>
              </Box>
            </Stack>

            {/* Refund guarantee */}
            <Box
              sx={{
                mt: 3,
                p: 2,
                bgcolor: 'info.50',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'info.200',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Lock sx={{ color: 'info.main', fontSize: 20, flexShrink: 0 }} />
              <Typography variant="caption" color="info.main">
                {t('orders.momoAwaiting.refundGuarantee', 'If not accepted, you get a refund.')}
              </Typography>
            </Box>
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
            <>
              <Button
                variant="contained"
                color="cta"
                size="large"
                disabled={retrying}
                startIcon={<Refresh />}
                onClick={() => void onRetry()}
              >
                {t('orders.momoAwaiting.retry', 'Try again')}
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Edit />}
                onClick={handleEditPhone}
              >
                {t('orders.momoAwaiting.editPhone', 'Edit phone number')}
              </Button>
            </>
          ) : null}
          {phase !== 'paid' ? (
            <Button variant="text" onClick={leaveToOrder}>
              {t('orders.momoAwaiting.back', 'Back to order')}
            </Button>
          ) : null}
        </Stack>

        {/* Good news: order is still reserved */}
        {phase === 'failed' && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              bgcolor: 'info.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'info.200',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
            }}
          >
            <CheckCircleOutline sx={{ color: 'info.main', fontSize: 20, flexShrink: 0 }} />
            <Box>
              <Typography variant="body2" fontWeight={600} color="info.main">
                {t('orders.momoAwaiting.orderReserved', 'Good news: your order is still reserved!')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('orders.momoAwaiting.orderReservedDesc', 'We have saved your items while you complete your payment.')}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Edit Phone Dialog */}
      <Dialog open={editPhoneOpen} onClose={() => setEditPhoneOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('orders.momoAwaiting.editPhoneTitle', 'Edit phone number')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('orders.momoAwaiting.editPhoneDesc', 'Make sure this matches your MoMo number')}
          </Typography>
          <PhoneInput
            value={newPhoneNumber}
            onChange={(value) => setNewPhoneNumber(value || '')}
            label={t('orders.momoAwaiting.phoneLabel', 'Phone number')}
            defaultCountry={pickMobileMoneyDefaultCountry()}
            onlyCountries={['CM', 'GA']}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPhoneOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleSavePhone}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MobileMoneyAwaitingPaymentPage;
