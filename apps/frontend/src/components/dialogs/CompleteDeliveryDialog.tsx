import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';

interface CompleteDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  onSuccess: () => void;
}

const CompleteDeliveryDialog: React.FC<CompleteDeliveryDialogProps> = ({
  open,
  onClose,
  orderId,
  orderNumber,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { completeDelivery } = useBackendOrders();
  const [pin, setPin] = useState('');
  const [overwriteCode, setOverwriteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const usePin = pin.trim().length > 0;
    const useOverwrite = overwriteCode.trim().length > 0;
    if (!usePin && !useOverwrite) {
      setError(
        t(
          'orders.completeDelivery.enterPinOrOverwrite',
          'Enter the 4-digit PIN from the client or the overwrite code from the business.'
        )
      );
      return;
    }
    if (usePin && useOverwrite) {
      setError(
        t(
          'orders.completeDelivery.enterOneOnly',
          'Enter either the PIN or the overwrite code, not both.'
        )
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await completeDelivery({
        orderId,
        ...(usePin ? { pin: pin.trim() } : { overwriteCode: overwriteCode.trim() }),
      });
      onSuccess();
      onClose();
      setPin('');
      setOverwriteCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to complete delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPin('');
      setOverwriteCode('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('orders.completeDelivery.title', 'Complete Delivery')} – {orderNumber}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'orders.completeDelivery.instruction',
            'Enter the 4-digit PIN the client shared with you, or the overwrite code from the business.'
          )}
        </Typography>
        <TextField
          label={t('orders.completeDelivery.pinLabel', 'Delivery PIN (4 digits)')}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
          inputProps={{ maxLength: 4, inputMode: 'numeric' }}
          fullWidth
          sx={{ mb: 2 }}
        />
        <TextField
          label={t('orders.completeDelivery.overwriteLabel', 'Or overwrite code')}
          value={overwriteCode}
          onChange={(e) => setOverwriteCode(e.target.value.trim())}
          fullWidth
          sx={{ mb: 1 }}
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || (pin.trim() === '' && overwriteCode.trim() === '')}
        >
          {loading
            ? t('common.loading', 'Loading...')
            : t('orders.completeDelivery.submit', 'Complete delivery')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CompleteDeliveryDialog;
