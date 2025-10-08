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
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useBackendOrders,
  useCancellationFee,
  useCancellationReasons,
} from '../../hooks';
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
  const { getCancellationFee, error: feeError } = useCancellationFee();

  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [otherReasonText, setOtherReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellationFee, setCancellationFee] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>('XAF');
  const [loadingFeeData, setLoadingFeeData] = useState(false);

  // Check if order can be cancelled for free
  const canCancelForFree = ['pending_payment', 'pending'].includes(
    order.current_status
  );

  // Check if order can be cancelled at all
  const canCancel = ![
    'assigned_to_agent',
    'out_for_delivery',
    'in_transit',
    'picked_up',
  ].includes(order.current_status);

  // Fetch cancellation fee when modal opens and order can be cancelled
  useEffect(() => {
    if (open && canCancel && !canCancelForFree && persona === 'client') {
      setLoadingFeeData(true);
      const countryCode = order.business_location?.address?.country || 'GA';

      getCancellationFee(countryCode)
        .then((feeData) => {
          if (feeData) {
            setCancellationFee(feeData.cancellationFee);
            setCurrency(feeData.currency);
          }
          setLoadingFeeData(false);
        })
        .catch(() => {
          setLoadingFeeData(false);
        });
    } else {
      setCancellationFee(null);
      setLoadingFeeData(false);
    }
  }, [
    open,
    canCancel,
    canCancelForFree,
    persona,
    order.business_location?.address?.country,
    getCancellationFee,
  ]);

  // Find if "other" reason is selected
  const selectedReason = reasons.find((r) => r.id === selectedReasonId);
  const isOtherSelected = selectedReason?.value === 'other';

  const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedReasonId(Number(event.target.value));
    setError(null);
  };

  const handleSubmit = async () => {
    // Check if order can be cancelled
    if (!canCancel) {
      setError(
        t(
          'orders.cannotCancelOrder',
          'This order cannot be cancelled as it has already been picked up by a delivery agent.'
        )
      );
      return;
    }

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

        {/* Cancellation Fee Information */}
        {!success && canCancel && persona === 'client' && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: canCancelForFree ? 'success.50' : 'warning.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: canCancelForFree ? 'success.200' : 'warning.200',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {canCancelForFree ? (
                <CheckCircle color="success" sx={{ fontSize: 20 }} />
              ) : (
                <Warning color="warning" sx={{ fontSize: 20 }} />
              )}
              <Typography
                variant="subtitle2"
                fontWeight="bold"
                color={canCancelForFree ? 'success.main' : 'warning.main'}
              >
                {canCancelForFree
                  ? t('orders.cancellationFree', 'Free Cancellation')
                  : t('orders.cancellationFee', 'Cancellation Fee')}
              </Typography>
            </Box>

            {canCancelForFree ? (
              <Typography variant="body2" color="success.dark">
                {t(
                  'orders.cancellationFreeMessage',
                  'You can cancel this order for free since it has not been confirmed yet.'
                )}
              </Typography>
            ) : (
              <Box>
                {loadingFeeData ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'orders.loadingCancellationFee',
                        'Loading cancellation fee...'
                      )}
                    </Typography>
                  </Box>
                ) : feeError ? (
                  <Typography variant="body2" color="error.main">
                    {t(
                      'orders.cancellationFeeError',
                      'Unable to load cancellation fee information.'
                    )}
                  </Typography>
                ) : cancellationFee !== null ? (
                  <Box>
                    <Typography
                      variant="body2"
                      color="warning.dark"
                      sx={{ mb: 1 }}
                    >
                      {t(
                        'orders.cancellationFeeMessage',
                        'A cancellation fee will be deducted from your refund:'
                      )}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color="warning.dark"
                    >
                      {cancellationFee.toLocaleString()} {currency}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 0.5 }}
                    >
                      {t(
                        'orders.cancellationFeeNote',
                        'This fee will be deducted from your refund amount.'
                      )}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="warning.dark">
                    {t(
                      'orders.cancellationFeeUnknown',
                      'A cancellation fee may apply. Please contact support for details.'
                    )}
                  </Typography>
                )}
              </Box>
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
                !canCancel ||
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
