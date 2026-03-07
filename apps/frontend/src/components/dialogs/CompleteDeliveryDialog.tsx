import React, { useCallback, useRef, useState } from 'react';
import {
  Box,
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
  const [pin, setPin] = useState<string[]>(() => Array(PIN_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinString = pin.join('');

  const setPinDigit = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setPin((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < PIN_LENGTH - 1) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
    }
  }, []);

  const handlePinKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !pin[index] && index > 0) {
        setPin((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        inputRefs.current[index - 1]?.focus();
      }
    },
    [pin]
  );

  const handleSubmit = async () => {
    if (pinString.length !== PIN_LENGTH) {
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
      await completeDelivery({ orderId, pin: pinString });
      onSuccess();
      onClose();
      setPin(Array(PIN_LENGTH).fill(''));
    } catch (err: any) {
      setError(err.message || 'Failed to complete delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPin(Array(PIN_LENGTH).fill(''));
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
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            justifyContent: 'center',
            mb: 2,
          }}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <TextField
              key={i}
              inputRef={(el) => {
                inputRefs.current[i] = el;
              }}
              value={pin[i]}
              onChange={(e) => setPinDigit(i, e.target.value)}
              onKeyDown={(e) => handlePinKeyDown(i, e)}
              inputProps={{
                maxLength: 1,
                inputMode: 'numeric',
                pattern: '[0-9]*',
                'aria-label': `${t('orders.completeDelivery.pinLabel', 'Digit')} ${i + 1}`,
              }}
              sx={{
                width: 56,
                '& .MuiInputBase-input': { textAlign: 'center', fontSize: '1.25rem' },
              }}
            />
          ))}
        </Box>
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
          disabled={loading || pinString.length !== PIN_LENGTH}
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
