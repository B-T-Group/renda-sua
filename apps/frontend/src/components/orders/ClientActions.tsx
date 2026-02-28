import { Cancel, Key } from '@mui/icons-material';
import {
  Box,
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
import type { OrderData } from '../../hooks/useOrderById';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';

interface ClientActionsProps {
  order: OrderData;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
  onShowHistory?: () => void;
}

const ClientActions: React.FC<ClientActionsProps> = ({
  order,
  onActionComplete,
  onShowNotification,
  onShowHistory,
}) => {
  const { t } = useTranslation();
  const { getDeliveryPin } = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [deliveryPin, setDeliveryPin] = useState<string | null>(null);

  const handleCancelClick = () => {
    setCancelModalOpen(true);
  };

  const handleCancelSuccess = () => {
    onShowNotification?.(
      t('messages.orderCancelSuccess', 'Order cancelled successfully'),
      'success'
    );
    onActionComplete?.();
  };

  const handleCancelError = (errorMessage: string) => {
    onShowNotification?.(errorMessage, 'error');
  };

  const handleViewDeliveryPin = async () => {
    setLoading(true);
    setDeliveryPin(null);
    try {
      const { pin } = await getDeliveryPin(order.id);
      setDeliveryPin(pin);
      setPinDialogOpen(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('orders.deliveryPin.unavailable', 'Delivery PIN is not available. If the order was just paid, try again in a moment.');
      onShowNotification?.(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableActions = () => {
    const actions = [];

    // Cancel action - available for pending_payment, pending, preparing, and ready_for_pickup statuses
    if (
      [
        'pending_payment',
        'pending',
        'preparing',
        'ready_for_pickup',
        'confirmed',
      ].includes(order.current_status)
    ) {
      actions.push({
        label: t('orderActions.cancelOrder', 'Cancel Order'),
        action: handleCancelClick,
        color: 'error' as const,
        icon: <Cancel />,
        isPinAction: false,
      });
    }

    // View delivery PIN - available once order is paid; client can retrieve multiple times until order is completed
    if (
      ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned_to_agent', 'picked_up', 'in_transit', 'out_for_delivery'].includes(
        order.current_status
      )
    ) {
      actions.push({
        label: t('orders.deliveryPin.viewPin', 'View delivery PIN'),
        action: handleViewDeliveryPin,
        color: 'primary' as const,
        icon: <Key />,
        isPinAction: true,
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  if (availableActions.length === 0) {
    return null;
  }

  const pinAction = availableActions.find((a) => (a as { isPinAction?: boolean }).isPinAction);
  const otherActions = availableActions.filter((a) => !(a as { isPinAction?: boolean }).isPinAction);

  return (
    <>
      {availableActions.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {pinAction && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={pinAction.action}
              disabled={loading}
              startIcon={
                loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  pinAction.icon
                )
              }
              sx={{
                py: 1.5,
                fontWeight: 600,
                boxShadow: 2,
                width: { xs: '100%', sm: 'auto' },
                alignSelf: { sm: 'flex-start' },
              }}
            >
              {pinAction.label}
            </Button>
          )}
          {otherActions.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                flexWrap: { sm: 'wrap' },
                gap: 2,
                justifyContent: { xs: 'stretch', sm: 'flex-end' },
              }}
            >
              {otherActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  color={action.color}
                  onClick={action.action}
                  startIcon={action.icon}
                  sx={{
                    minWidth: { xs: 0, sm: 120 },
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        persona="client"
        onSuccess={handleCancelSuccess}
        onError={handleCancelError}
      />

      {/* Delivery PIN dialog (client can view multiple times until order is completed) */}
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

export default ClientActions;
