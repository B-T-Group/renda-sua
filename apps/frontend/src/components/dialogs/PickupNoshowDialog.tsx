import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import type { OrderData } from '../../hooks/useOrderById';

interface PickupFailureReason {
  id: string;
  reason_key: string;
  reason: string;
}

interface NoshowPreview {
  canCancel: boolean;
  hours: number;
  opensAt: string | null;
  cancellationFee: number;
  cancellationFeePercent: number;
  merchantShare: number;
  refundAmount: number;
  currency: string;
  /** > 0 for an unpaid pay-at-pickup order: the held deposit is the no-show penalty (no fee). */
  depositForfeitAmount?: number;
}

interface Props {
  open: boolean;
  order: OrderData;
  onClose: () => void;
  onSuccess?: () => void;
}

const PickupNoshowDialog: React.FC<Props> = ({ open, order, onClose, onSuccess }) => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const apiClient = useApiClient();
  const [preview, setPreview] = useState<NoshowPreview | null>(null);
  const [reasons, setReasons] = useState<PickupFailureReason[]>([]);
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
    Promise.all([
      apiClient.get<NoshowPreview>(`/orders/${order.id}/pickup-noshow`),
      apiClient.get<{ reasons: PickupFailureReason[] }>(`/failed-pickups/reasons?language=${lang}`),
    ])
      .then(([noshow, reasonRes]) => {
        if (cancelled) return;
        setPreview(noshow.data);
        setReasons(reasonRes.data.reasons ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          enqueueSnackbar(
            t('orders.pickupNoshow.loadError', 'Could not load pickup options'),
            { variant: 'error' }
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, order.id, apiClient, enqueueSnackbar, i18n.language, t]);

  const remind = async () => {
    setBusy(true);
    try {
      await apiClient.post(`/orders/${order.id}/pickup-reminder`);
      enqueueSnackbar(t('orders.pickupNoshow.reminded', 'Reminder sent'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(
        error?.response?.data?.message ||
          error?.message ||
          t('orders.pickupNoshow.remindError', 'Could not send the reminder'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelPickup = async () => {
    if (!reasonId) {
      enqueueSnackbar(
        t('orders.failPickup.selectReasonRequired', 'Please select a failure reason'),
        { variant: 'warning' }
      );
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(`/orders/${order.id}/cancel-uncollected-pickup`, {
        failure_reason_id: reasonId,
        notes: notes.trim() || undefined,
      });
      enqueueSnackbar(
        (preview?.depositForfeitAmount ?? 0) > 0
          ? t(
              'orders.pickupNoshow.cancelledDeposit',
              "Pickup cancelled. The client's reservation deposit is kept as the no-show penalty."
            )
          : t('orders.pickupNoshow.cancelled', 'Pickup cancelled. The client is refunded except for the fee.'),
        { variant: 'success' }
      );
      onSuccess?.();
      onClose();
    } catch (error: any) {
      enqueueSnackbar(
        error?.response?.data?.message ||
          error?.message ||
          t('orders.pickupNoshow.cancelError', 'Could not cancel this pickup'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  const depositLine =
    preview && (preview.depositForfeitAmount ?? 0) > 0
      ? t(
          'orders.pickupNoshow.depositLine',
          "No fee. The client's {{amount}} {{currency}} reservation deposit is kept by Rendasua as the no-show penalty.",
          {
            amount: (preview.depositForfeitAmount ?? 0).toLocaleString(),
            currency: preview.currency,
          }
        )
      : null;
  const feeLine = depositLine ??
    (preview && preview.cancellationFee > 0
      ? t(
          'orders.pickupNoshow.feeLine',
          'Fee {{fee}} {{currency}} ({{percent}}% of the items). You receive {{share}} {{currency}}. The client gets back {{refund}} {{currency}}.',
          {
            fee: preview.cancellationFee.toLocaleString(),
            share: preview.merchantShare.toLocaleString(),
            refund: preview.refundAmount.toLocaleString(),
            currency: preview.currency,
            percent: preview.cancellationFeePercent,
          }
        )
      : null);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('orders.pickupNoshow.title', 'Client pickup')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            {t(
              'orders.pickupNoshow.remindBody',
              'Order #{{orderNumber}} is ready. Send a reminder to come and collect it.',
              { orderNumber: order.order_number }
            )}
          </Typography>
          <Button variant="contained" onClick={remind} disabled={busy}>
            {t('orders.pickupNoshow.remind', 'Remind client')}
          </Button>
          {!preview ? (
            <CircularProgress size={20} />
          ) : preview.canCancel ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">{feeLine}</Typography>
              <TextField
                select
                SelectProps={{ native: true }}
                label={t('orders.failPickup.reasonLabel', 'Why did the pickup fail?')}
                value={reasonId}
                onChange={(event) => setReasonId(event.target.value)}
              >
                <option value="" />
                {reasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.reason}
                  </option>
                ))}
              </TextField>
              <TextField
                label={t('orders.failPickup.notesOptional', 'Notes (optional)')}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t(
                'orders.pickupNoshow.wait',
                'You can cancel for a no-show after the order has been ready for {{hours}} hours.',
                { hours: preview.hours }
              )}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
        {preview?.canCancel ? (
          <Button color="error" variant="contained" onClick={cancelPickup} disabled={busy}>
            {t('orders.pickupNoshow.cancel', 'Cancel — client did not pick up')}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default PickupNoshowDialog;
