import { CheckCircle, Close } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { isFoodCategoryName } from '../../../constants/food';
import {
  ConfirmOrderData,
  OrderStatusChangeResponse,
} from '../../../hooks/useBackendOrders';
import type { OrderData } from '../../../hooks/useOrderById';
import type { FoodConfirmationStockUpdate } from '../../../types/food';
import FoodOrderStockPrompt, { type FoodOrderLine } from './FoodOrderStockPrompt';
import { CookedFoodReadyClockIllustration } from './CookedFoodReadyClockIllustration';

const PRESET_MINUTES = [15, 30, 45, 60] as const;
const MIN_CUSTOM = 5;
const MAX_CUSTOM = 180;

interface CookedFoodConfirmOrderModalProps {
  open: boolean;
  order: OrderData | null;
  onClose: () => void;
  onConfirm: (data: ConfirmOrderData) => Promise<OrderStatusChangeResponse>;
  loading?: boolean;
}

const CookedFoodConfirmOrderModal: React.FC<CookedFoodConfirmOrderModalProps> = ({
  open,
  order,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedMinutes, setSelectedMinutes] = useState<number | 'custom'>(30);
  const [customMinutes, setCustomMinutes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [foodStockUpdates, setFoodStockUpdates] = useState<
    Record<string, FoodConfirmationStockUpdate>
  >({});

  const foodLines: FoodOrderLine[] = useMemo(
    () =>
      (order?.order_items ?? [])
        .filter((line) => {
          if (line.item?.is_cooked_food === true) return true;
          if (line.item?.is_cooked_food === false) return false;
          return isFoodCategoryName(
            line.item?.item_sub_category?.item_category?.name
          );
        })
        .map((line) => ({
          order_item_id: line.id,
          name: line.item_name || line.item?.name || '',
          quantity: line.quantity,
        })),
    [order?.order_items]
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelectedMinutes(30);
    setCustomMinutes('');
    setError('');
    setFoodStockUpdates({});
  }, [open, order?.id]);

  const resolveReadyMinutes = useCallback((): number | null => {
    if (selectedMinutes !== 'custom') return selectedMinutes;
    const parsed = Number.parseInt(customMinutes, 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < MIN_CUSTOM || parsed > MAX_CUSTOM) return null;
    return parsed;
  }, [customMinutes, selectedMinutes]);

  const handleConfirmReady = useCallback(async () => {
    setError('');
    const readyInMinutes = resolveReadyMinutes();
    if (readyInMinutes == null) {
      setError(
        t(
          'orders.cookedFood.invalidReadyMinutes',
          'Enter a ready time between {{min}} and {{max}} minutes.',
          { min: MIN_CUSTOM, max: MAX_CUSTOM }
        )
      );
      return;
    }
    if (!order) {
      setError(t('orders.confirmModal.noOrder', 'No order selected'));
      return;
    }
    setSubmitting(true);
    try {
      const payload: ConfirmOrderData = {
        orderId: order.id,
        ready_in_minutes: readyInMinutes,
      };
      const stockUpdates = Object.values(foodStockUpdates);
      if (stockUpdates.length > 0) {
        payload.food_stock_updates = stockUpdates;
      }
      const result = await onConfirm(payload);
      if (result?.pay_after_merchant_confirm) {
        setStep(2);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ||
        t('orders.confirmModal.confirmError', 'Failed to confirm order');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [foodStockUpdates, onClose, onConfirm, order, resolveReadyMinutes, t]);

  if (!order) return null;

  const busy = loading || submitting;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {step === 1
              ? t('orders.cookedFood.confirmTitle', 'When will it be ready?')
              : t('orders.cookedFood.waitPaymentTitle', 'Waiting for payment')}
            {' · '}
            #{order.order_number}
          </Typography>
          {step === 1 ? (
            <Button onClick={onClose} size="small" startIcon={<Close />} disabled={busy}>
              {t('common.close', 'Close')}
            </Button>
          ) : null}
        </Box>
      </DialogTitle>

      <DialogContent>
        {step === 1 ? (
          <Stack spacing={2}>
            <CookedFoodReadyClockIllustration />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {t(
                'orders.cookedFood.readyHint',
                'Choose how long you need to prepare this cooked-food pickup order.'
              )}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center">
              {PRESET_MINUTES.map((m) => (
                <Chip
                  key={m}
                  label={t('orders.cookedFood.minutesChip', '{{m}} min', { m })}
                  color={selectedMinutes === m ? 'primary' : 'default'}
                  variant={selectedMinutes === m ? 'filled' : 'outlined'}
                  onClick={() => setSelectedMinutes(m)}
                  disabled={busy}
                />
              ))}
              <Chip
                label={t('orders.cookedFood.customChip', 'Custom')}
                color={selectedMinutes === 'custom' ? 'primary' : 'default'}
                variant={selectedMinutes === 'custom' ? 'filled' : 'outlined'}
                onClick={() => setSelectedMinutes('custom')}
                disabled={busy}
              />
            </Stack>
            {selectedMinutes === 'custom' ? (
              <TextField
                type="number"
                label={t('orders.cookedFood.customMinutes', 'Minutes until ready')}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value.replace(/\D/g, ''))}
                inputProps={{ min: MIN_CUSTOM, max: MAX_CUSTOM }}
                disabled={busy}
                fullWidth
              />
            ) : null}
            <FoodOrderStockPrompt
              lines={foodLines}
              updates={foodStockUpdates}
              onChange={setFoodStockUpdates}
              disabled={busy}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="info">
              {t(
                'orders.cookedFood.waitPaymentBody',
                'We sent the client a mobile money payment request. Wait until you receive a payment notification before you start cooking.'
              )}
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, flexDirection: 'column', alignItems: 'stretch' }}>
        {step === 1 ? (
          <Box display="flex" gap={2} justifyContent="flex-end" width="100%">
            <Button onClick={onClose} disabled={busy}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleConfirmReady()}
              disabled={busy}
              startIcon={<CheckCircle />}
            >
              {busy
                ? t('orders.confirmModal.confirming', 'Confirming...')
                : t('orders.cookedFood.confirmReady', 'Confirm ready time')}
            </Button>
          </Box>
        ) : (
          <Stack spacing={1.5} width="100%">
            <Button variant="contained" onClick={() => navigate('/dashboard')}>
              {t('orders.cookedFood.returnDashboard', 'Return to dashboard')}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/orders?queue=prep')}>
              {t('orders.cookedFood.viewOrdersToCook', 'View orders to cook')}
            </Button>
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CookedFoodConfirmOrderModal;
