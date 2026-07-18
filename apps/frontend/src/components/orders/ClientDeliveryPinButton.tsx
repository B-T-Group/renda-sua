import { Key, Send } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';

const RESEND_COOLDOWN_MS = 60_000;

export interface ClientDeliveryPinButtonProps {
  orderId: string;
  /** `send` posts PIN to agent chat; `show` displays PIN for store pickup. */
  displayMode?: 'send' | 'show';
  fullWidth?: boolean;
  size?: 'large' | 'medium' | 'small';
  variant?: 'contained' | 'outlined';
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
  onSent?: () => void;
}

export const ClientDeliveryPinButton: React.FC<ClientDeliveryPinButtonProps> = ({
  orderId,
  displayMode = 'send',
  fullWidth,
  size = 'large',
  variant = 'contained',
  onShowNotification,
  onSent,
}) => {
  const { t } = useTranslation();
  const { sendDeliveryPin, getDeliveryPin } = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState<string | null>(null);

  const startCooldown = useCallback(() => {
    const now = Date.now();
    setSentAt(now);
    setCooldownRemaining(RESEND_COOLDOWN_MS);
    const interval = setInterval(() => {
      const remaining = RESEND_COOLDOWN_MS - (Date.now() - now);
      if (remaining <= 0) {
        setCooldownRemaining(0);
        clearInterval(interval);
      } else {
        setCooldownRemaining(remaining);
      }
    }, 1000);
  }, []);

  const handleShowPin = async () => {
    setLoading(true);
    try {
      const result = await getDeliveryPin(orderId);
      setPinValue(result.pin);
      setPinDialogOpen(true);
      onSent?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t(
              'orders.deliveryPin.unavailable',
              'Delivery PIN is not available. If the order was just paid, try again in a moment.'
            );
      onShowNotification?.(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendDeliveryPin = async () => {
    setLoading(true);
    try {
      await sendDeliveryPin(orderId);
      onShowNotification?.(
        t(
          'orders.messaging.deliveryPin.sendSuccess',
          'Delivery PIN sent to your agent in the order chat.'
        ),
        'success'
      );
      startCooldown();
      onSent?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t(
              'orders.deliveryPin.unavailable',
              'Delivery PIN is not available. If the order was just paid, try again in a moment.'
            );
      onShowNotification?.(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (displayMode === 'show') {
    return (
      <>
        <Button
          variant={variant}
          color="primary"
          size={size}
          onClick={() => void handleShowPin()}
          disabled={loading}
          fullWidth={fullWidth}
          startIcon={
            loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <Key />
            )
          }
          sx={{
            py: size === 'large' ? 1.5 : undefined,
            fontWeight: 600,
            boxShadow: variant === 'contained' ? 2 : undefined,
          }}
          aria-label={t(
            'orders.deliveryPin.showPickupA11y',
            'Show pickup PIN for the seller'
          )}
          aria-busy={loading}
        >
          {t('orders.deliveryPin.showPickupPin', 'Show pickup PIN')}
        </Button>
        <Dialog
          open={pinDialogOpen}
          onClose={() => setPinDialogOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>
            {t('orders.deliveryPin.pickupTitle', 'Pickup PIN')}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'orders.deliveryPin.shareWithSeller',
                'Show this PIN to the seller so they can confirm your pickup.'
              )}
            </Typography>
            <Typography
              variant="h3"
              align="center"
              sx={{ letterSpacing: 8, fontFamily: 'monospace', fontWeight: 700 }}
            >
              {pinValue}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPinDialogOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  const cooldownActive = cooldownRemaining > 0;
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

  return (
    <Stack spacing={1} sx={{ width: fullWidth ? '100%' : undefined }}>
      <Button
        variant={variant}
        color="primary"
        size={size}
        onClick={() => void handleSendDeliveryPin()}
        disabled={loading}
        fullWidth={fullWidth}
        startIcon={
          loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : sentAt ? (
            <Send />
          ) : (
            <Key />
          )
        }
        sx={{
          py: size === 'large' ? 1.5 : undefined,
          fontWeight: 600,
          boxShadow: variant === 'contained' ? 2 : undefined,
        }}
        aria-label={t(
          'orders.messaging.deliveryPin.sendA11y',
          'Send delivery PIN to assigned agent'
        )}
        aria-busy={loading}
      >
        {t('orders.messaging.deliveryPin.sendPin', 'Send delivery PIN')}
      </Button>
      {sentAt && !loading ? (
        <Typography variant="caption" color="text.secondary">
          {t(
            'orders.messaging.deliveryPin.sentConfirmation',
            'PIN shared in order chat. Your agent will be notified.'
          )}
        </Typography>
      ) : null}
      {sentAt && cooldownActive ? (
        <Typography variant="caption" color="text.secondary">
          {t(
            'orders.messaging.deliveryPin.resendCooldown',
            'You can send again in {{seconds}}s',
            { seconds: cooldownSeconds }
          )}
        </Typography>
      ) : sentAt && !cooldownActive ? (
        <Link
          component="button"
          type="button"
          variant="caption"
          onClick={() => void handleSendDeliveryPin()}
          disabled={loading}
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('orders.messaging.deliveryPin.resend', 'Send again')}
        </Link>
      ) : null}
    </Stack>
  );
};
