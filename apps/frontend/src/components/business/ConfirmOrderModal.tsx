import {
  CalendarToday,
  CheckCircle,
  Close,
  Schedule,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmOrderData } from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';
import DeliveryTimeWindowSelector from '../common/DeliveryTimeWindowSelector';

interface ConfirmOrderModalProps {
  open: boolean;
  order: OrderData | null;
  onClose: () => void;
  onConfirm: (data: ConfirmOrderData) => Promise<void>;
  loading?: boolean;
}

interface DeliveryWindowOption {
  id: string;
  preferred_date: string;
  time_slot_start: string;
  time_slot_end: string;
  special_instructions?: string;
  slot?: {
    slot_name?: string;
    slot_type?: string;
  };
}

const ConfirmOrderModal: React.FC<ConfirmOrderModalProps> = ({
  open,
  order,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [createNewWindow, setCreateNewWindow] = useState(false);
  const [newWindowData, setNewWindowData] = useState<{
    slot_id: string;
    preferred_date: string;
    special_instructions?: string;
  } | null>(null);
  const [error, setError] = useState<string>('');

  // Calculate existing windows using optional chaining
  const allExistingWindows: DeliveryWindowOption[] =
    order?.delivery_time_windows || [];

  // Show all windows, even if expired or in the past
  const existingWindows = allExistingWindows;
  const hasExistingWindows = existingWindows.length > 0;

  // Find valid delivery window from order (first valid one)
  const validDeliveryWindow = useMemo(() => {
    if (
      !order?.delivery_time_windows ||
      order.delivery_time_windows.length === 0
    ) {
      return null;
    }
    // Find first valid window (not expired, not in the past)
    const now = new Date();
    const validWindow = order.delivery_time_windows.find((window) => {
      const windowDate = new Date(window.preferred_date);
      windowDate.setHours(23, 59, 59, 999);
      return windowDate >= now;
    });

    if (validWindow) {
      const windowWithSlotId = validWindow as DeliveryWindowOption & {
        slot_id?: string;
      };
      if (windowWithSlotId.slot_id) {
        return {
          slot_id: windowWithSlotId.slot_id,
          preferred_date: validWindow.preferred_date,
        };
      }
    }
    return null;
  }, [order]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedWindowId('');
      setCreateNewWindow(false);
      setNewWindowData(null);
      setError('');
    }
  }, [open]);

  const handleWindowSelection = useCallback((windowId: string) => {
    setSelectedWindowId(windowId);
    setCreateNewWindow(false);
    setNewWindowData(null);
  }, []);

  const handleCreateNewWindow = useCallback(() => {
    setCreateNewWindow(true);
    setSelectedWindowId('');
    setNewWindowData(null);
  }, []);

  const handleNewWindowChange = useCallback(
    (
      data: {
        slot_id: string;
        preferred_date: string;
        special_instructions?: string;
      } | null
    ) => {
      setNewWindowData(data);
    },
    []
  );

  const formatDate = useCallback((dateString: string) => {
    return new Date(`${dateString}T00:00:00.000`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const formatTime = useCallback((timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    setError('');

    // Validate that a delivery window is selected
    if (!selectedWindowId && !newWindowData) {
      setError(
        t(
          'orders.confirmModal.noWindowSelected',
          'Please select a delivery time window'
        )
      );
      return;
    }

    if (!order) {
      setError(t('orders.confirmModal.noOrder', 'No order selected'));
      return;
    }

    // Validate selected window if using existing window
    if (selectedWindowId) {
      const selectedWindow = existingWindows.find(
        (w) => w.id === selectedWindowId
      );
      if (!selectedWindow) {
        setError(
          t(
            'orders.confirmModal.windowNotFound',
            'Selected delivery window not found'
          )
        );
        return;
      }
    }

    try {
      const confirmData: ConfirmOrderData = {
        orderId: order.id,
      };

      if (selectedWindowId) {
        confirmData.delivery_time_window_id = selectedWindowId;
      } else if (newWindowData) {
        confirmData.delivery_window_details = newWindowData;
      }

      await onConfirm(confirmData);
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        (err as { message?: string })?.message ||
        t('orders.confirmModal.confirmError', 'Failed to confirm order');
      setError(errorMessage);
    }
  }, [
    selectedWindowId,
    newWindowData,
    order,
    onConfirm,
    onClose,
    t,
    existingWindows,
  ]);

  // Early return after all hooks
  if (!order) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' },
      }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6">
            {t('orders.confirmModal.title', 'Confirm Order')} #
            {order.order_number}
          </Typography>
          <Button onClick={onClose} size="small" startIcon={<Close />}>
            {t('common.close', 'Close')}
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Stack spacing={2}>
          {/* Order Summary */}
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.confirmModal.totalAmount', 'Total Amount')}
                  </Typography>
                  <Typography variant="h6">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: order.currency || 'USD',
                    }).format(
                      order.total_amount ||
                        (order.subtotal || 0) +
                          (order.base_delivery_fee || 0) +
                          (order.per_km_delivery_fee || 0)
                    )}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.confirmModal.items', 'Items')}
                  </Typography>
                  <Typography variant="body1">
                    {order.order_items.length}{' '}
                    {t('orders.confirmModal.itemCount', 'item(s)')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Delivery Window Selection */}
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h6" gutterBottom>
                {t(
                  'orders.confirmModal.deliveryWindow',
                  'Delivery Time Window'
                )}
              </Typography>

              {hasExistingWindows && !createNewWindow && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {t(
                      'orders.confirmModal.clientPreferences',
                      "Client's preferred delivery windows:"
                    )}
                  </Typography>

                  <RadioGroup
                    value={selectedWindowId}
                    onChange={(e) => handleWindowSelection(e.target.value)}
                  >
                    {existingWindows.map((window) => (
                      <Card key={window.id} sx={{ mb: 1.5, p: 1.5 }}>
                        <FormControlLabel
                          value={window.id}
                          control={<Radio />}
                          label={
                            <Box sx={{ ml: 1 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  mb: 1,
                                }}
                              >
                                <CalendarToday
                                  fontSize="small"
                                  color="action"
                                />
                                <Typography variant="body1" fontWeight="medium">
                                  {formatDate(window.preferred_date)}
                                </Typography>
                                <Chip
                                  label={
                                    window.slot?.slot_type === 'fast'
                                      ? t(
                                          'orders.fastDelivery.title',
                                          'Fast Delivery'
                                        )
                                      : t('orders.standardDelivery', 'Standard')
                                  }
                                  size="small"
                                  color={
                                    window.slot?.slot_type === 'fast'
                                      ? 'error'
                                      : 'primary'
                                  }
                                />
                              </Box>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <Schedule fontSize="small" color="action" />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {formatTime(window.time_slot_start)} -{' '}
                                  {formatTime(window.time_slot_end)}
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  ({window.slot?.slot_name})
                                </Typography>
                              </Box>
                              {window.special_instructions && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ mt: 1 }}
                                >
                                  {t(
                                    'orders.confirmModal.specialInstructions',
                                    'Special Instructions'
                                  )}
                                  : {window.special_instructions}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </Card>
                    ))}
                  </RadioGroup>

                  <Button
                    variant="outlined"
                    onClick={handleCreateNewWindow}
                    sx={{ mt: 2 }}
                  >
                    {t(
                      'orders.confirmModal.createDifferentWindow',
                      'Create Different Time Window'
                    )}
                  </Button>
                </Box>
              )}

              {(!hasExistingWindows || createNewWindow) && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {createNewWindow
                      ? t(
                          'orders.confirmModal.createNewWindow',
                          'Create a new delivery time window:'
                        )
                      : t(
                          'orders.confirmModal.noClientPreferences',
                          'No client preferences available. Create a delivery time window:'
                        )}
                  </Typography>

                  <DeliveryTimeWindowSelector
                    countryCode={order.delivery_address.country}
                    stateCode={order.delivery_address.state}
                    onChange={handleNewWindowChange}
                    isFastDelivery={order.requires_fast_delivery}
                    loading={loading}
                    validDeliveryWindow={validDeliveryWindow}
                    shouldFetchNextAvailable={!hasExistingWindows}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Error Display - shown next to confirm button */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={loading || (!selectedWindowId && !newWindowData)}
            startIcon={<CheckCircle />}
          >
            {loading
              ? t('orders.confirmModal.confirming', 'Confirming...')
              : t('orders.confirmModal.confirm', 'Confirm Order')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmOrderModal;
