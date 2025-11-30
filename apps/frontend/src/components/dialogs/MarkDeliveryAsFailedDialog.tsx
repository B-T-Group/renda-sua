import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FailureReason,
  useFailedDeliveries,
} from '../../hooks/useFailedDeliveries';
import type { OrderData } from '../../hooks/useOrderById';

interface MarkDeliveryAsFailedDialogProps {
  open: boolean;
  order: OrderData;
  onClose: () => void;
  onConfirm: (failureReasonId: string, notes?: string) => Promise<void>;
  loading?: boolean;
}

const MarkDeliveryAsFailedDialog: React.FC<
  MarkDeliveryAsFailedDialogProps
> = ({ open, order, onClose, onConfirm, loading = false }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getFailureReasons, loading: reasonsLoading } = useFailedDeliveries();

  const [failureReasons, setFailureReasons] = useState<FailureReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (open) {
      loadFailureReasons();
    } else {
      // Reset form when dialog closes
      setSelectedReasonId('');
      setNotes('');
    }
  }, [open]);

  const loadFailureReasons = async () => {
    try {
      const reasons = await getFailureReasons('fr'); // Default to French
      setFailureReasons(reasons);
    } catch (err: any) {
      console.error('Error loading failure reasons:', err);
      enqueueSnackbar(
        t(
          'orders.failDelivery.loadReasonsError',
          'Failed to load failure reasons'
        ),
        { variant: 'error' }
      );
    }
  };

  const handleConfirm = async () => {
    if (!selectedReasonId) {
      enqueueSnackbar(
        t(
          'orders.failDelivery.selectReasonRequired',
          'Please select a failure reason'
        ),
        { variant: 'warning' }
      );
      return;
    }

    try {
      await onConfirm(selectedReasonId, notes.trim() || undefined);
    } catch (err: any) {
      // Error handling is done in parent component
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('orders.failDelivery.title', 'Mark Delivery as Failed')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Order Information */}
          <Box>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              {t('orders.failDelivery.orderInfo', 'Order Information')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('orders.failDelivery.orderNumber', 'Order #{{orderNumber}}', {
                orderNumber: order.order_number,
              })}
            </Typography>
          </Box>

          {/* Failure Reason Selection */}
          <Box>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              {t(
                'orders.failDelivery.selectReason',
                'Select Failure Reason'
              )}{' '}
              <Typography component="span" color="error">
                *
              </Typography>
            </Typography>
            {reasonsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : failureReasons.length > 0 ? (
              <FormControl fullWidth>
                <RadioGroup
                  value={selectedReasonId}
                  onChange={(e) => setSelectedReasonId(e.target.value)}
                >
                  {failureReasons.map((reason) => (
                    <FormControlLabel
                      key={reason.id}
                      value={reason.id}
                      control={<Radio />}
                      label={reason.reason}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            ) : (
              <Alert severity="error">
                {t(
                  'orders.failDelivery.noReasonsAvailable',
                  'No failure reasons available. Please try again later.'
                )}
              </Alert>
            )}
          </Box>

          {/* Notes Field */}
          <TextField
            label={t('orders.failDelivery.notesLabel', 'Additional Notes (Optional)')}
            multiline
            rows={3}
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(
              'orders.failDelivery.notesPlaceholder',
              'Add any additional details about why the delivery failed...'
            )}
          />

          {/* Info Alert */}
          <Alert severity="info">
            <Typography variant="body2">
              {t(
                'orders.failDelivery.info',
                'This action will mark the delivery as failed. The business will be notified and will need to resolve this failed delivery.'
              )}
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={loading || !selectedReasonId || reasonsLoading}
        >
          {loading
            ? t('orders.failDelivery.marking', 'Marking as Failed...')
            : t('orders.failDelivery.confirm', 'Mark as Failed')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MarkDeliveryAsFailedDialog;

