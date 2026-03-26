import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import { PinCodeFields } from '../common/PinCodeFields';

const PIN_LENGTH = 4;

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (pin.length !== PIN_LENGTH) {
      setError(
        t(
          'orders.completeDelivery.enterPinOrOverwrite',
          'Enter the 4-digit PIN from the client.'
        )
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await completeDelivery({ orderId, pin });
      onSuccess();
      onClose();
      setPin('');
    } catch (err: any) {
      setError(err.message || 'Failed to complete delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPin('');
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
            'Enter the 4-digit PIN the client shared with you.'
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t('orders.completeDelivery.pinLabel', 'Delivery PIN (4 digits)')}
        </Typography>
        <PinCodeFields
          value={pin}
          onChange={setPin}
          length={PIN_LENGTH}
          disabled={loading}
          autoFocus
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
          disabled={loading || pin.length !== PIN_LENGTH}
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
