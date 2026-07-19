import { Key, Send } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';

const RESEND_COOLDOWN_MS = 60_000;

export interface ClientDeliveryPinButtonProps {
  orderId: string;
  /** Who receives the PIN in order chat. */
  pinAudience?: 'agent' | 'business';
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
  pinAudience = 'agent',
  fullWidth,
  size = 'large',
  variant = 'contained',
  onShowNotification,
  onSent,
}) => {
  const { t } = useTranslation();
  const { sendDeliveryPin } = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const inFlightRef = useRef(false);

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

  const handleSendDeliveryPin = async () => {
    if (inFlightRef.current || cooldownRemaining > 0) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      await sendDeliveryPin(orderId);
      onShowNotification?.(
        pinAudience === 'business'
          ? t(
              'orders.messaging.deliveryPin.sendSuccessPickup',
              'Pickup PIN sent to the store in the order chat.'
            )
          : t(
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
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const cooldownActive = cooldownRemaining > 0;
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

  return (
    <Stack spacing={1} sx={{ width: fullWidth ? '100%' : undefined }}>
      <Button
        variant={variant}
        color="primary"
        size={size}
        onClick={() => void handleSendDeliveryPin()}
        disabled={loading || cooldownActive}
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
        aria-label={
          pinAudience === 'business'
            ? t(
                'orders.messaging.deliveryPin.sendPickupA11y',
                'Send pickup PIN to the store'
              )
            : t(
                'orders.messaging.deliveryPin.sendA11y',
                'Send delivery PIN to assigned agent'
              )
        }
        aria-busy={loading}
      >
        {pinAudience === 'business'
          ? t('orders.actions.sendPin', 'Send PIN')
          : t('orders.messaging.deliveryPin.sendPin', 'Send delivery PIN')}
      </Button>
      {sentAt && !loading ? (
        <Typography variant="caption" color="text.secondary">
          {pinAudience === 'business'
            ? t(
                'orders.messaging.deliveryPin.sentConfirmationPickup',
                'PIN shared in order chat. The store will be notified.'
              )
            : t(
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
