import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
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
  const { completeDelivery, getActiveDeliveryPin } = useBackendOrders();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolvingPin, setResolvingPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPinMessageId, setAutoPinMessageId] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [noSharedPin, setNoSharedPin] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    setPin('');
    setError(null);
    setAutoPinMessageId(null);
    setShowManualEntry(false);
    setNoSharedPin(false);
    submitLockRef.current = false;

    let cancelled = false;
    (async () => {
      setResolvingPin(true);
      try {
        const active = await getActiveDeliveryPin(orderId);
        if (cancelled) return;
        if (active?.pin) {
          setPin(active.pin);
          setAutoPinMessageId(active.messageId);
        } else {
          setNoSharedPin(true);
          setShowManualEntry(true);
        }
      } catch {
        if (!cancelled) {
          setNoSharedPin(true);
          setShowManualEntry(true);
        }
      } finally {
        if (!cancelled) setResolvingPin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orderId, getActiveDeliveryPin]);

  const handleSubmit = async () => {
    const useAuto = !!autoPinMessageId && pin.length === PIN_LENGTH && !showManualEntry;

    if (!useAuto && pin.length !== PIN_LENGTH) {
      setError(
        t(
          'orders.completeDelivery.enterPinOrOverwrite',
          'Enter the 4-digit PIN from the client.'
        )
      );
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setError(null);
    setLoading(true);
    try {
      if (useAuto && autoPinMessageId) {
        await completeDelivery({
          orderId,
          useLatestSharedPin: true,
          pinMessageId: autoPinMessageId,
        });
      } else {
        await completeDelivery({ orderId, pin });
      }
      onSuccess();
      onClose();
      setPin('');
    } catch (err: any) {
      setError(err.message || 'Failed to complete delivery');
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  };

  const handleClose = () => {
    if (!loading && !resolvingPin) {
      setPin('');
      setError(null);
      onClose();
    }
  };

  const handleDialogClose = (
    _event: object,
    reason: 'backdropClick' | 'escapeKeyDown'
  ) => {
    if (loading || resolvingPin) return;
    if (error && reason === 'backdropClick') return;
    handleClose();
  };

  const canSubmit =
    !loading &&
    !resolvingPin &&
    (autoPinMessageId || pin.length === PIN_LENGTH);

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('orders.completeDelivery.title', 'Complete Delivery')} – {orderNumber}
      </DialogTitle>
      <DialogContent>
        {resolvingPin ? (
          <Typography variant="body2" color="text.secondary">
            {t('orders.completeDelivery.resolvingPin', 'Looking for shared delivery PIN…')}
          </Typography>
        ) : null}

        {noSharedPin && !resolvingPin ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t(
              'orders.messaging.deliveryPin.agentNoPin',
              'The client has not shared a delivery PIN in the order chat yet. Ask them to tap Send delivery PIN, or enter the PIN manually below.'
            )}
          </Alert>
        ) : null}

        {autoPinMessageId && !showManualEntry && !resolvingPin ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" role="status">
              {t(
                'orders.completeDelivery.usingSharedPin',
                'Using the delivery PIN shared by the client in order chat.'
              )}
            </Typography>
            <Typography
              variant="h5"
              component="div"
              sx={{ fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center', py: 2 }}
            >
              {pin}
            </Typography>
            <Link
              component="button"
              type="button"
              variant="caption"
              onClick={() => {
                setShowManualEntry(true);
                setPin('');
                setAutoPinMessageId(null);
              }}
            >
              {t('orders.completeDelivery.enterManually', 'Enter PIN manually instead')}
            </Link>
          </Box>
        ) : null}

        {(showManualEntry || (!autoPinMessageId && !resolvingPin)) && !resolvingPin ? (
          <>
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
              autoFocus={showManualEntry}
            />
          </>
        ) : null}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={handleClose} disabled={loading || resolvingPin}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
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
