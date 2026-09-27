import {
  Box,
  Button,
  Chip,
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
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import type { OrderData } from '../../hooks/useOrderById';

interface PickupFailureReason {
  id: string;
  reason_key: string;
  reason: string;
}

interface FailPickupDialogProps {
  open: boolean;
  order: OrderData;
  onClose: () => void;
  onSuccess?: () => void;
}

const FailPickupDialog: React.FC<FailPickupDialogProps> = ({
  open,
  order,
  onClose,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const apiClient = useApiClient();
  const [reasons, setReasons] = useState<PickupFailureReason[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setSelectedReasonId('');
      setNotes('');
      return;
    }
    let cancelled = false;
    setLoadingReasons(true);
    const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
    apiClient
      .get<{ success: boolean; reasons: PickupFailureReason[] }>(
        `/failed-pickups/reasons?language=${lang}`
      )
      .then((res) => {
        if (!cancelled) setReasons(res.reasons ?? []);
      })
      .catch(() => {
        enqueueSnackbar(
          t(
            'orders.failPickup.loadReasonsError',
            'Failed to load failure reasons'
          ),
          { variant: 'error' }
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingReasons(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, apiClient, enqueueSnackbar, i18n.language, t]);

  const selected = reasons.find((r) => r.id === selectedReasonId);
  const needsNotes = selected?.reason_key === 'other';

  const handleConfirm = async () => {
    if (!selectedReasonId || (needsNotes && !notes.trim())) {
      enqueueSnackbar(
        t(
          'orders.failPickup.selectReasonRequired',
          'Please select a failure reason'
        ),
        { variant: 'warning' }
      );
      return;
    }
    if (lockRef.current) return;
    lockRef.current = true;
    setSubmitting(true);
    try {
      await apiClient.post(`/orders/${order.id}/fail-pickup`, {
        failure_reason_id: selectedReasonId,
        notes: notes.trim() || undefined,
      });
      enqueueSnackbar(
        t('orders.failPickup.success', 'Pickup marked as failed'),
        { variant: 'success' }
      );
      onSuccess?.();
      onClose();
    } catch (error: any) {
      enqueueSnackbar(
        error?.message ||
          t('orders.failPickup.error', 'Failed to mark pickup as failed'),
        { variant: 'error' }
      );
    } finally {
      setSubmitting(false);
      lockRef.current = false;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('orders.failPickup.title', 'Mark pickup as failed')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('orders.failPickup.orderNumber', 'Order #{{orderNumber}}', {
              orderNumber: order.order_number,
            })}
          </Typography>
          <Typography variant="body2">
            {t(
              'orders.failPickup.feeNote',
              'The client receives a partial refund after the standard cancellation fee is retained.'
            )}
          </Typography>
          <Typography variant="subtitle2">
            {t('orders.failPickup.reasonLabel', 'Why did the pickup fail?')}
          </Typography>
          {loadingReasons ? (
            <CircularProgress size={24} />
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {reasons.map((reason) => (
                <Chip
                  key={reason.id}
                  label={reason.reason}
                  color={
                    selectedReasonId === reason.id ? 'primary' : 'default'
                  }
                  variant={
                    selectedReasonId === reason.id ? 'filled' : 'outlined'
                  }
                  onClick={() => setSelectedReasonId(reason.id)}
                />
              ))}
            </Box>
          )}
          {needsNotes && (
            <TextField
              label={t(
                'orders.failPickup.notesLabel',
                'Please describe the reason'
              )}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          )}
          {!needsNotes && (
            <TextField
              label={t('orders.failPickup.notesOptional', 'Notes (optional)')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={submitting || !selectedReasonId}
        >
          {submitting ? (
            <CircularProgress size={20} />
          ) : (
            t('orders.failPickup.confirm', 'Mark as failed')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FailPickupDialog;
