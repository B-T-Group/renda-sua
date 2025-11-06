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
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
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
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedWindowId('');
      setCreateNewWindow(false);
      setNewWindowData(null);
      setNotes('');
      setError('');
    }
  }, [open]);

  const handleWindowSelection = useCallback(
    (windowId: string) => {
      setSelectedWindowId(windowId);
      setCreateNewWindow(false);
      setNewWindowData(null);

      // Prefill delivery instructions from the selected window's special_instructions
      if (order) {
        const selectedWindow = order.delivery_time_windows?.find(
          (w) => w.id === windowId
        );
        if (selectedWindow?.special_instructions) {
          setNotes(selectedWindow.special_instructions);
        } else {
          setNotes('');
        }
      }
    },
    [order]
  );

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
    return new Date(dateString).toLocaleDateString('en-US', {
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

  // Calculate existing windows using optional chaining
  const allExistingWindows: DeliveryWindowOption[] =
    order?.delivery_time_windows || [];

  // Show all windows, even if expired or in the past
  const existingWindows = allExistingWindows;
  const hasExistingWindows = existingWindows.length > 0;

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

    // Validate new window if creating new one
    if (newWindowData) {
      const now = new Date();
      const windowDate = new Date(newWindowData.preferred_date);
      // Backend will handle time validation
      if (windowDate.toDateString() === now.toDateString()) {
        // Backend will validate if it's today
      }
    }

    try {
      const confirmData: ConfirmOrderData = {
        orderId: order.id,
        notes: notes.trim() || undefined,
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
    notes,
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
        sx: { minHeight: '600px' },
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

      <DialogContent>
        <Stack spacing={3}>
          {/* Order Summary */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('orders.confirmModal.orderSummary', 'Order Summary')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 200px' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.confirmModal.totalAmount', 'Total Amount')}
                  </Typography>
                  <Typography variant="h6">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: order.currency || 'USD',
                    }).format(order.total_amount)}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px' }}>
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

          {/* Error Display */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Delivery Window Selection */}
          <Card>
            <CardContent>
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
                      <Card key={window.id} sx={{ mb: 2, p: 2 }}>
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
                    value={newWindowData}
                    onChange={handleNewWindowChange}
                    isFastDelivery={order.requires_fast_delivery}
                    disabled={loading}
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Notes Field */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('orders.confirmModal.notes', 'Confirmation Notes')}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(
                  'orders.confirmModal.notesPlaceholder',
                  'Add any notes about this confirmation...'
                )}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
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
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmOrderModal;
