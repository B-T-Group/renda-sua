import {
  Cancel,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
} from '@mui/icons-material';
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
  IconButton,
  Radio,
  RadioGroup,
  Skeleton,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders, useCancellationReasons } from '../../hooks';
import type { OrderData } from '../../hooks/useOrderById';

export interface CancellationReasonModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderData;
  persona: 'client' | 'business';
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

const CancellationReasonModal: React.FC<CancellationReasonModalProps> = ({
  open,
  onClose,
  order,
  persona,
  onSuccess,
  onError,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { reasons, loading: loadingReasons } = useCancellationReasons(persona);
  const { cancelOrder } = useBackendOrders();

  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [otherReasonText, setOtherReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find if "other" reason is selected
  const selectedReason = reasons.find((r) => r.id === selectedReasonId);
  const isOtherSelected = selectedReason?.value === 'other';

  const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedReasonId(Number(event.target.value));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedReasonId) {
      setError(
        t(
          'orders.selectCancellationReason',
          'Please select a cancellation reason'
        )
      );
      return;
    }

    if (isOtherSelected && !otherReasonText.trim()) {
      setError(
        t(
          'orders.provideOtherReason',
          'Please provide a reason for cancellation'
        )
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build the notes field
      let notes = selectedReason?.display || '';
      if (isOtherSelected && otherReasonText.trim()) {
        notes = `other: ${otherReasonText.trim()}`;
      }

      await cancelOrder({
        orderId: order.id,
        notes,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t('orders.cancelFailed', 'Failed to cancel order');
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSelectedReasonId(null);
      setOtherReasonText('');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  const getPersonaTitle = () => {
    if (persona === 'client') {
      return t('orders.cancelOrderAsClient', 'Cancel Order');
    }
    return t('orders.cancelOrderAsBusiness', 'Cancel Order');
  };

  const getPersonaDescription = () => {
    if (persona === 'client') {
      return t(
        'orders.cancelOrderClientDescription',
        'Please select a reason for canceling this order. This will help us improve our service.'
      );
    }
    return t(
      'orders.cancelOrderBusinessDescription',
      'Please select a reason for canceling this order. The customer will be notified.'
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" sx={{ fontSize: 28 }} />
            <Typography variant="h6" component="div" fontWeight="bold">
              {getPersonaTitle()}
            </Typography>
          </Box>
          {!submitting && (
            <IconButton onClick={handleClose} size="small">
              <Cancel />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ px: isMobile ? 2 : 3, py: 3 }}>
        {/* Success Message */}
        {success && (
          <Alert
            severity="success"
            icon={<CheckCircle />}
            sx={{ mb: 3, '& .MuiAlert-message': { width: '100%' } }}
          >
            <Typography variant="body1" fontWeight="medium">
              {t('orders.cancelSuccess', 'Order cancelled successfully')}
            </Typography>
          </Alert>
        )}

        {/* Order Information */}
        {!success && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              gutterBottom
            >
              {t('orders.orderDetails', 'Order Details')}
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {t('orders.orderNumber', 'Order')} #{order.order_number}
            </Typography>
            {order.business && (
              <Typography variant="body2" color="text.secondary">
                {t('orders.from', 'From')}: {order.business.name}
              </Typography>
            )}
          </Box>
        )}

        {/* Description */}
        {!success && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {getPersonaDescription()}
          </Typography>
        )}

        {/* Error Message */}
        {error && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loadingReasons && !success && (
          <Box>
            {[1, 2, 3, 4, 5].map((i) => (
              <Box key={i} sx={{ mb: 2 }}>
                <Skeleton
                  variant="rectangular"
                  height={48}
                  sx={{ borderRadius: 1 }}
                />
              </Box>
            ))}
          </Box>
        )}

        {/* Cancellation Reasons */}
        {!loadingReasons && !success && reasons.length > 0 && (
          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <RadioGroup
              value={selectedReasonId?.toString() || ''}
              onChange={handleReasonChange}
            >
              {reasons.map((reason) => (
                <Box key={reason.id} sx={{ mb: 1 }}>
                  <FormControlLabel
                    value={reason.id.toString()}
                    control={<Radio />}
                    label={
                      <Typography variant="body1" sx={{ ml: 1 }}>
                        {reason.display}
                      </Typography>
                    }
                    sx={{
                      m: 0,
                      p: 1.5,
                      border: '1px solid',
                      borderColor:
                        selectedReasonId === reason.id
                          ? 'primary.main'
                          : 'divider',
                      borderRadius: 1,
                      bgcolor:
                        selectedReasonId === reason.id
                          ? 'primary.50'
                          : 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'grey.50',
                        borderColor: 'primary.light',
                      },
                    }}
                  />

                  {/* Text field for "other" reason */}
                  {reason.value === 'other' &&
                    selectedReasonId === reason.id && (
                      <Box sx={{ mt: 2, ml: 4 }}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          label={t(
                            'orders.pleaseSpecify',
                            'Please specify the reason'
                          )}
                          placeholder={t(
                            'orders.otherReasonPlaceholder',
                            'Enter your reason for canceling this order...'
                          )}
                          value={otherReasonText}
                          onChange={(e) => setOtherReasonText(e.target.value)}
                          disabled={submitting}
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'background.paper',
                            },
                          }}
                        />
                      </Box>
                    )}
                </Box>
              ))}
            </RadioGroup>
          </FormControl>
        )}

        {/* No Reasons Available */}
        {!loadingReasons && !success && reasons.length === 0 && (
          <Alert severity="warning">
            {t(
              'orders.noCancellationReasons',
              'No cancellation reasons available at this time'
            )}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: isMobile ? 2 : 3, py: 2 }}>
        {!success && (
          <>
            <Button
              onClick={handleClose}
              disabled={submitting}
              variant="outlined"
              size="large"
              fullWidth={isMobile}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !selectedReasonId ||
                (isOtherSelected && !otherReasonText.trim())
              }
              variant="contained"
              color="error"
              size="large"
              fullWidth={isMobile}
              startIcon={
                submitting ? <CircularProgress size={20} /> : <Warning />
              }
            >
              {submitting
                ? t('orders.cancelling', 'Cancelling...')
                : t('orders.cancelOrder', 'Cancel Order')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CancellationReasonModal;
