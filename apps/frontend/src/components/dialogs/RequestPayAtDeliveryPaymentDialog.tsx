import { Phone, PaymentsOutlined, ScheduleOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import PhoneInput from '../common/PhoneInput';

interface RequestPayAtDeliveryPaymentDialogProps {
  open: boolean;
  order: OrderData;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RequestPayAtDeliveryPaymentDialog({
  open,
  order,
  onClose,
  onSuccess,
}: RequestPayAtDeliveryPaymentDialogProps) {
  const { t } = useTranslation();
  const backendOrders = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [useDifferentPhone, setUseDifferentPhone] = useState(false);
  const [overridePhoneNumber, setOverridePhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clientPhone = order.client?.user?.phone_number?.trim() || '';

  const effectivePhone = useMemo(() => {
    if (useDifferentPhone) return overridePhoneNumber.trim();
    return clientPhone;
  }, [clientPhone, overridePhoneNumber, useDifferentPhone]);

  const isPayAtDelivery =
    order.payment_timing === 'pay_at_delivery' ||
    order.payment_method === 'pay_on_delivery';

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await backendOrders.initiatePayAtDeliveryPayment(
        order.id,
        useDifferentPhone ? effectivePhone : undefined
      );
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('common.error', 'Something went wrong')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('orders.paymentTiming.label', 'When do you want to pay?')}
      </DialogTitle>
      <DialogContent>
        {!isPayAtDelivery ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t(
              'orders.payAtDelivery.notEligible',
              'This order is not configured for pay at delivery.'
            )}
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t(
              'orders.payAtDelivery.agentInitiateHelp',
              'Send a mobile payment request to the client. Once they approve it, the order will complete automatically.'
            )}
          </Alert>
        )}

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                flexShrink: 0,
              }}
            >
              <PaymentsOutlined fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700}>
                {t('orders.paymentTiming.payAtDelivery', 'Pay at delivery')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'orders.payAtDelivery.agentInitiateSubtitle',
                  'Payment is requested at the doorstep.'
                )}
              </Typography>
            </Box>
            <ScheduleOutlined color="action" />
          </Stack>
        </Paper>

        <Stack spacing={1}>
          <Typography variant="subtitle2">
            {t('orders.paymentPhoneNumber', 'Payment Phone Number')}
          </Typography>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Phone color="primary" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700}>
                  {clientPhone || t('common.notAvailable', 'Not available')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'orders.payAtDelivery.clientPhoneHint',
                    'This is the client phone number on the order.'
                  )}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <FormControlLabel
            control={
              <Switch
                checked={useDifferentPhone}
                onChange={(e) => setUseDifferentPhone(e.target.checked)}
                disabled={loading}
              />
            }
            label={t(
              'orders.useDifferentPhone',
              'Use a different phone number'
            )}
            sx={{ mt: 1 }}
          />

          {useDifferentPhone ? (
            <PhoneInput
              value={overridePhoneNumber}
              onChange={(v) => setOverridePhoneNumber(v || '')}
              label={t(
                'orders.overridePhoneNumber',
                'Phone Number for Payment'
              )}
              defaultCountry="GA"
              disabled={loading}
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !isPayAtDelivery || !effectivePhone}
        >
          {t('orderActions.requestPayment', 'Request payment')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

