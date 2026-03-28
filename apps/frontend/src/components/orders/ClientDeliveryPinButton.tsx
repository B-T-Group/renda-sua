import { Key } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';

export interface ClientDeliveryPinButtonProps {
  orderId: string;
  fullWidth?: boolean;
  size?: 'large' | 'medium' | 'small';
  variant?: 'contained' | 'outlined';
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
}

export const ClientDeliveryPinButton: React.FC<ClientDeliveryPinButtonProps> = ({
  orderId,
  fullWidth,
  size = 'large',
  variant = 'contained',
  onShowNotification,
}) => {
  const { t } = useTranslation();
  const { getDeliveryPin } = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [deliveryPin, setDeliveryPin] = useState<string | null>(null);

  const handleViewDeliveryPin = async () => {
    setLoading(true);
    setDeliveryPin(null);
    try {
      const { pin } = await getDeliveryPin(orderId);
      setDeliveryPin(pin);
      setPinDialogOpen(true);
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

  return (
    <>
      <Button
        variant={variant}
        color="primary"
        size={size}
        onClick={handleViewDeliveryPin}
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
      >
        {t('orders.deliveryPin.viewPin', 'View delivery PIN')}
      </Button>

      <Dialog
        open={pinDialogOpen}
        onClose={() => {
          setPinDialogOpen(false);
          setDeliveryPin(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('orders.deliveryPin.title', 'Delivery PIN')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'orders.deliveryPin.shareWithAgent',
              'Share this PIN with your delivery agent. They will enter it to complete the delivery.'
            )}
          </Typography>
          {deliveryPin && (
            <Typography
              variant="h4"
              component="div"
              sx={{
                fontFamily: 'monospace',
                letterSpacing: 4,
                textAlign: 'center',
                py: 2,
              }}
            >
              {deliveryPin}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPinDialogOpen(false);
              setDeliveryPin(null);
            }}
          >
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
