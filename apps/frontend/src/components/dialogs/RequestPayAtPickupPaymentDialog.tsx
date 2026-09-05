import { Phone, PaymentsOutlined, StorefrontOutlined } from '@mui/icons-material';
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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parsePhoneNumber } from 'libphonenumber-js';
import type { OrderData } from '../../hooks/useOrderById';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import PhoneInput from '../common/PhoneInput';
import { pickMobileMoneyDefaultCountry } from '../../utils/mobileMoneyCountry';
import {
  buildMomoAwaitingPaymentTo,
  type MobileMoneyAwaitingPaymentState,
} from '../../utils/momoAwaitingPaymentNav';
import { useNavigate } from 'react-router-dom';

function isPickupMomoPhone(phone: string): boolean {
  if (!phone.trim()) return false;
  try {
    const parsed = parsePhoneNumber(phone);
    const iso = parsed?.country;
    return parsed.isValid() && (iso === 'CM' || iso === 'GA');
  } catch {
    return false;
  }
}

interface RequestPayAtPickupPaymentDialogProps {
  open: boolean;
  order: OrderData;
  onClose: () => void;
  onSuccess?: () => void;
  /** Client pays in the app; business can still send a request as fallback. */
  audience?: 'business' | 'client';
}

export default function RequestPayAtPickupPaymentDialog({
  open,
  order,
  onClose,
  onSuccess,
  audience = 'business',
}: RequestPayAtPickupPaymentDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backendOrders = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [useDifferentPhone, setUseDifferentPhone] = useState(false);
  const [overridePhoneNumber, setOverridePhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clientPhone = order.client?.user?.phone_number?.trim() || '';
  const profilePhoneOk = isPickupMomoPhone(clientPhone);

  useEffect(() => {
    if (!open) {
      setUseDifferentPhone(false);
      setOverridePhoneNumber('');
      return;
    }
    setUseDifferentPhone(!profilePhoneOk);
  }, [open, profilePhoneOk]);

  const effectivePhone = useMemo(() => {
    if (useDifferentPhone) return overridePhoneNumber.trim();
    return clientPhone;
  }, [clientPhone, overridePhoneNumber, useDifferentPhone]);

  const canSubmitPhone = useDifferentPhone
    ? isPickupMomoPhone(effectivePhone)
    : profilePhoneOk;

  const isPayAtPickup =
    order.payment_timing === 'pay_at_pickup' ||
    order.payment_method === 'pay_at_pickup';

  const isPickupOrder = order.fulfillment_method === 'pickup';

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await backendOrders.initiatePayAtPickupPayment(
        order.id,
        useDifferentPhone ? effectivePhone : undefined
      );
      onClose();
      if (audience === 'client') {
        const phoneE164 = effectivePhone || clientPhone;
        navigate(
          buildMomoAwaitingPaymentTo({
            orderIds: [order.id],
            phoneE164,
            source: 'pickup',
            orderNumbers: [order.order_number],
          } satisfies MobileMoneyAwaitingPaymentState)
        );
        return;
      }
      onSuccess?.();
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
        {audience === 'client'
          ? t('orders.payAtPickup.title', 'Pay at pickup')
          : t('orders.pickup.requestPaymentTitle', 'Request pickup payment')}
      </DialogTitle>
      <DialogContent>
        {!isPayAtPickup || !isPickupOrder ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t(
              'orders.pickup.notEligibleForPaymentRequest',
              'This order is not configured for pay at pickup.'
            )}
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            {audience === 'client'
              ? t(
                  'orders.payAtPickup.hint',
                  'We will send a mobile money request to this number. Approve it on your phone. The store will see the payment, then you can collect your order.'
                )
              : t(
                  'orders.pickup.businessInitiateHelp',
                  'If the client needs help, send a mobile payment request. When they approve it, the order will complete automatically.'
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
                {t('orders.pickup.payAtPickupShort', 'Pay at pickup')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'orders.pickup.businessInitiateSubtitle',
                  'Payment is collected when the customer picks up the order.'
                )}
              </Typography>
            </Box>
            <StorefrontOutlined color="action" />
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
                disabled={loading || !profilePhoneOk}
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
              defaultCountry={pickMobileMoneyDefaultCountry(
                order.business_location?.address?.country
              )}
              onlyCountries={['CM', 'GA']}
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
          disabled={
            loading || !isPayAtPickup || !isPickupOrder || !canSubmitPhone
          }
        >
          {audience === 'client'
            ? t('orders.payAtPickup.cta', 'Pay now')
            : t('orderActions.requestPickupPayment', 'Request pickup payment')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
