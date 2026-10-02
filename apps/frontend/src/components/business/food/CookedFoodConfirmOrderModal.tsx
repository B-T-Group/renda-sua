import { CheckCircle } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
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
import { isStorePayAfterConfirmOrder } from '../../../utils/cookedFoodOrder';
import { PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES } from '../../../utils/payAfterConfirm';
import FoodOrderStockPrompt, { type FoodOrderLine } from './FoodOrderStockPrompt';
import { CookedFoodReadyClockIllustration } from './CookedFoodReadyClockIllustration';
import { CookedFoodWaitPaymentIllustration } from './CookedFoodWaitPaymentIllustration';

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

  // Flagged-location goods: no ready-in prompt; explain pay-after + 45-min auto-cancel.
  const storePayAfter = order ? isStorePayAfterConfirmOrder(order as any) : false;

  const resolveReadyMinutes = useCallback((): number | null => {
    if (selectedMinutes !== 'custom') return selectedMinutes;
    const parsed = Number.parseInt(customMinutes, 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < MIN_CUSTOM || parsed > MAX_CUSTOM) return null;
    return parsed;
  }, [customMinutes, selectedMinutes]);

  const handleConfirmReady = useCallback(async () => {
    setError('');
    const readyInMinutes = storePayAfter ? undefined : resolveReadyMinutes();
    if (!storePayAfter && readyInMinutes == null) {
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
        ...(readyInMinutes != null ? { ready_in_minutes: readyInMinutes } : {}),
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
  }, [foodStockUpdates, onClose, onConfirm, order, resolveReadyMinutes, storePayAfter, t]);

  if (!order) return null;

  const busy = loading || submitting;
  const isPickup = order.fulfillment_method === 'pickup';
  const readyMinutes = resolveReadyMinutes();

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="overline" color="text.secondary">
          {t('orders.cookedFood.orderLabel', 'Order #{{number}}', {
            number: order.order_number,
          })}
          {' · '}
          {isPickup
            ? t('orders.cookedFood.pickup', 'Pickup')
            : t('orders.cookedFood.delivery', 'Delivery')}
        </Typography>
        <Typography variant="h6">
          {storePayAfter
            ? step === 1
              ? t('orders.payAfterConfirm.business.confirmTitle', 'Confirm this order')
              : t('orders.payAfterConfirm.business.waitPaymentTitle', 'Wait for payment before preparing')
            : step === 1
              ? t('orders.cookedFood.confirmTitle', 'When will it be ready?')
              : t('orders.cookedFood.waitPaymentTitle', 'Do not start cooking yet')}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {storePayAfter ? (
          step === 1 ? (
            <StoreConfirmStep error={error} />
          ) : (
            <StoreWaitPaymentStep isPickup={isPickup} />
          )
        ) : step === 1 ? (
          <ReadyTimeStep
            lines={foodLines}
            selectedMinutes={selectedMinutes}
            customMinutes={customMinutes}
            readyMinutes={readyMinutes}
            busy={busy}
            error={error}
            foodStockUpdates={foodStockUpdates}
            onSelect={setSelectedMinutes}
            onCustomChange={setCustomMinutes}
            onStockChange={setFoodStockUpdates}
          />
        ) : (
          <WaitPaymentStep isPickup={isPickup} />
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, flexDirection: 'column', alignItems: 'stretch' }}>
        {step === 1 ? (
          <ConfirmActions
            busy={busy}
            readyMinutes={storePayAfter ? 0 : readyMinutes}
            plain={storePayAfter}
            onClose={onClose}
            onConfirm={() => void handleConfirmReady()}
          />
        ) : (
          <WaitActions
            storePayAfter={storePayAfter}
            onDashboard={() => navigate('/dashboard')}
            onOrders={() => navigate('/orders?queue=prep')}
          />
        )}
      </DialogActions>
    </Dialog>
  );
};

function ReadyTimeStep({
  lines,
  selectedMinutes,
  customMinutes,
  readyMinutes,
  busy,
  error,
  foodStockUpdates,
  onSelect,
  onCustomChange,
  onStockChange,
}: {
  lines: FoodOrderLine[];
  selectedMinutes: number | 'custom';
  customMinutes: string;
  readyMinutes: number | null;
  busy: boolean;
  error: string;
  foodStockUpdates: Record<string, FoodConfirmationStockUpdate>;
  onSelect: (value: number | 'custom') => void;
  onCustomChange: (value: string) => void;
  onStockChange: (updates: Record<string, FoodConfirmationStockUpdate>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <CookedFoodReadyClockIllustration />
      <DishSummary lines={lines} />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {t(
          'orders.cookedFood.readyHint',
          'Tell the client how long you need. They pay after you confirm. Start cooking only after that payment arrives.'
        )}
      </Typography>
      <ReadyMinuteGrid selected={selectedMinutes} disabled={busy} onSelect={onSelect} />
      {selectedMinutes === 'custom' ? (
        <TextField
          type="number"
          label={t('orders.cookedFood.customMinutes', 'Minutes until ready')}
          value={customMinutes}
          onChange={(e) => onCustomChange(e.target.value.replace(/\D/g, ''))}
          helperText={t('orders.cookedFood.customHelp', 'Whole number from {{min}} to {{max}}.', {
            min: MIN_CUSTOM,
            max: MAX_CUSTOM,
          })}
          inputProps={{ min: MIN_CUSTOM, max: MAX_CUSTOM }}
          disabled={busy}
          fullWidth
        />
      ) : null}
      {readyMinutes != null ? (
        <Typography variant="subtitle1" textAlign="center" fontWeight={700}>
          {t('orders.cookedFood.readyIn', 'Ready in {{m}} minutes', { m: readyMinutes })}
        </Typography>
      ) : null}
      <FoodOrderStockPrompt
        lines={lines}
        updates={foodStockUpdates}
        onChange={onStockChange}
        disabled={busy}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}

function DishSummary({ lines }: { lines: FoodOrderLine[] }) {
  if (lines.length === 0) return null;
  return (
    <Stack spacing={0.5}>
      {lines.map((line) => (
        <Typography key={line.order_item_id} variant="body1" textAlign="center" fontWeight={600}>
          {line.quantity}× {line.name}
        </Typography>
      ))}
    </Stack>
  );
}

function ReadyMinuteGrid({
  selected,
  disabled,
  onSelect,
}: {
  selected: number | 'custom';
  disabled: boolean;
  onSelect: (value: number | 'custom') => void;
}) {
  const { t } = useTranslation();
  const options: Array<number | 'custom'> = [...PRESET_MINUTES, 'custom'];
  return (
    <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1}>
      {options.map((option) => (
        <MinuteTile
          key={String(option)}
          selected={selected === option}
          disabled={disabled}
          label={
            option === 'custom'
              ? t('orders.cookedFood.customChip', 'Custom')
              : t('orders.cookedFood.minutesChip', '{{m}} min', { m: option })
          }
          onPress={() => onSelect(option)}
        />
      ))}
    </Box>
  );
}

function MinuteTile({
  selected,
  disabled,
  label,
  onPress,
}: {
  selected: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onPress}
      sx={{
        py: 1.75,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.main' : 'background.paper',
        color: selected ? 'primary.contrastText' : 'text.primary',
      }}
    >
      <Typography variant="subtitle1" fontWeight={700}>
        {label}
      </Typography>
    </ButtonBase>
  );
}

function WaitPaymentStep({ isPickup }: { isPickup: boolean }) {
  const { t } = useTranslation();
  const steps = [
    t('orders.cookedFood.waitStepSent', 'A Mobile Money request is on the client’s phone.'),
    t('orders.cookedFood.waitStepWait', 'Wait for the payment notification.'),
    t('orders.cookedFood.waitStepCook', 'Start cooking only after you see that payment.'),
  ];
  return (
    <Stack spacing={2}>
      <CookedFoodWaitPaymentIllustration />
      {steps.map((label, index) => (
        <WaitRow key={label} index={index + 1} label={label} />
      ))}
      <Alert severity="warning">
        {isPickup
          ? t(
              'orders.cookedFood.waitPickup',
              'When it is ready, the client picks it up and completes the order in the app.'
            )
          : t(
              'orders.cookedFood.waitDelivery',
              'When it is ready, a courier picks it up for delivery.'
            )}
      </Alert>
    </Stack>
  );
}

function WaitRow({ index, label }: { index: number; label: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Typography variant="subtitle2" color="warning.dark" fontWeight={700} width={20}>
        {index}
      </Typography>
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

function StoreConfirmStep({ error }: { error: string }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        {t(
          'orders.payAfterConfirm.business.confirmBody',
          'After you confirm, the client is asked to pay by Mobile Money. They have {{m}} minutes; unpaid orders are cancelled automatically and the stock is released.',
          { m: PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES }
        )}
      </Alert>
      <Typography variant="body2" color="text.secondary">
        {t(
          'orders.payAfterConfirm.business.confirmHint',
          'Do not prepare the order until you see the payment. Once it is paid, mark it ready when prepared. If you cannot fulfil a paid order, you can cancel it and the client is refunded.'
        )}
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}

function StoreWaitPaymentStep({ isPickup }: { isPickup: boolean }) {
  const { t } = useTranslation();
  const steps = [
    t('orders.payAfterConfirm.business.waitStepSent', 'A Mobile Money request is on the client’s phone.'),
    t('orders.payAfterConfirm.business.waitStepWait', 'Wait for the payment notification ({{m}} minutes).', {
      m: PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES,
    }),
    t('orders.payAfterConfirm.business.waitStepPrepare', 'Prepare the order only after you see that payment, then mark it ready.'),
  ];
  return (
    <Stack spacing={2}>
      {steps.map((label, index) => (
        <WaitRow key={label} index={index + 1} label={label} />
      ))}
      <Alert severity="warning">
        {isPickup
          ? t(
              'orders.payAfterConfirm.business.waitPickup',
              'When it is ready, the client picks it up and completes the order in the app.'
            )
          : t(
              'orders.payAfterConfirm.business.waitDelivery',
              'When it is ready, a courier picks it up for delivery.'
            )}
      </Alert>
    </Stack>
  );
}

function ConfirmActions({
  busy,
  readyMinutes,
  plain,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  readyMinutes: number | null;
  plain?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const label = plain
    ? t('orders.payAfterConfirm.business.confirmCta', 'Confirm order')
    : readyMinutes == null
      ? t('orders.cookedFood.confirmReady', 'Confirm ready time')
      : t('orders.cookedFood.confirmReadyMinutes', 'Confirm · {{m}} min', { m: readyMinutes });
  return (
    <Box display="flex" gap={2} justifyContent="flex-end" width="100%">
      <Button onClick={onClose} disabled={busy}>
        {t('common.back', 'Back')}
      </Button>
      <Button
        variant="contained"
        onClick={onConfirm}
        disabled={busy || readyMinutes == null}
        startIcon={<CheckCircle />}
      >
        {busy ? t('orders.confirmModal.confirming', 'Confirming...') : label}
      </Button>
    </Box>
  );
}

function WaitActions({
  storePayAfter,
  onDashboard,
  onOrders,
}: {
  storePayAfter: boolean;
  onDashboard: () => void;
  onOrders: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1.5} width="100%">
      <Button variant="contained" onClick={onDashboard}>
        {t('orders.cookedFood.returnDashboard', 'Return to dashboard')}
      </Button>
      <Button variant="outlined" onClick={onOrders}>
        {storePayAfter
          ? t('orders.payAfterConfirm.business.viewOrders', 'View orders')
          : t('orders.cookedFood.viewOrdersToCook', 'View orders to cook')}
      </Button>
    </Stack>
  );
}

export default CookedFoodConfirmOrderModal;
