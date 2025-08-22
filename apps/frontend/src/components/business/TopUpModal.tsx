import { Close as CloseIcon } from '@mui/icons-material';
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from '../common/PhoneInput';

type PaymentMethod = 'mtn-momo' | 'airtel-money' | 'moov-money' | 'credit-card';

interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    phoneNumber: string,
    amount: string,
    paymentMethod: PaymentMethod
  ) => Promise<boolean>;
  userPhoneNumber?: string;
  currency: string;
  loading?: boolean;
}

const TopUpModal: React.FC<TopUpModalProps> = ({
  open,
  onClose,
  onConfirm,
  userPhoneNumber,
  currency,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mtn-momo');

  // Update phone number when userPhoneNumber prop changes
  useEffect(() => {
    if (userPhoneNumber) {
      setPhoneNumber(userPhoneNumber);
    }
  }, [userPhoneNumber]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setError('');
      setSuccess('');
      setShowResult(false);
      setAmount('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (paymentMethod === 'credit-card') {
      setError(
        'Credit card payments are not yet supported. Please select MTN MoMo or Airtel Money.'
      );
      return;
    }

    setError('');
    setSuccess('');
    setShowResult(false);

    try {
      const success = await onConfirm(phoneNumber, amount, paymentMethod);

      if (success) {
        setSuccess(
          paymentMethod === 'mtn-momo'
            ? t('accounts.paymentMessages.mtnMomoSuccess')
            : t('accounts.paymentMessages.airtelMoneySuccess')
        );
        setShowResult(true);
        setAmount('');
      } else {
        setError('Failed to send payment request. Please try again.');
        setShowResult(true);
      }
    } catch (err) {
      setError(
        'An error occurred while sending the payment request. Please try again.'
      );
      setShowResult(true);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess('');
    setShowResult(false);
    setAmount('');
    onClose();
  };

  const handleCloseAlert = () => {
    setError('');
    setSuccess('');
    setShowResult(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          Top Up Request
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {/* Success Alert */}
          {showResult && success && (
            <Alert
              severity="success"
              sx={{ mb: 3 }}
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={handleCloseAlert}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
            >
              <Typography variant="body2">{success}</Typography>
            </Alert>
          )}

          {/* Error Alert */}
          {showResult && error && (
            <Alert
              severity="error"
              sx={{ mb: 3 }}
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={handleCloseAlert}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
            >
              <Typography variant="body2">{error}</Typography>
            </Alert>
          )}

          {/* Info Alert - only show when no result is displayed */}
          {!showResult && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                {paymentMethod === 'mtn-momo' &&
                  t('accounts.paymentMessages.mtnMomoInfo')}
                {paymentMethod === 'airtel-money' &&
                  t('accounts.paymentMessages.airtelMoneyInfo')}
                {paymentMethod === 'moov-money' &&
                  t('accounts.paymentMessages.moovMoneyInfo')}
                {paymentMethod === 'credit-card' &&
                  t('accounts.paymentMessages.creditCardNotSupported')}
              </Typography>
            </Alert>
          )}

          {/* Form - only show when no result is displayed */}
          {!showResult && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel id="payment-method-label">
                  {t('accounts.paymentMethods.title')}
                </InputLabel>
                <Select
                  labelId="payment-method-label"
                  value={paymentMethod}
                  label={t('accounts.paymentMethods.title')}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                >
                  <MenuItem value="mtn-momo">
                    {t('accounts.paymentMethods.mtnMomo')}
                  </MenuItem>
                  <MenuItem value="airtel-money">
                    {t('accounts.paymentMethods.airtelMoney')}
                  </MenuItem>
                  <MenuItem value="moov-money">
                    {t('accounts.paymentMethods.moovMoney')}
                  </MenuItem>
                  <MenuItem value="credit-card" disabled>
                    {t('accounts.paymentMethods.creditCardComingSoon')}
                  </MenuItem>
                </Select>
              </FormControl>

              <PhoneInput
                label="Phone Number"
                value={phoneNumber}
                onChange={(value) => setPhoneNumber(value || '')}
                placeholder="Enter phone number for payment"
                required
                error={!!error && !phoneNumber.trim()}
                helperText={error && !phoneNumber.trim() ? error : ''}
                disabled={paymentMethod === 'credit-card'}
              />

              <TextField
                fullWidth
                label={`Amount (${currency})`}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount to top up"
                required
                error={!!error && (!amount.trim() || parseFloat(amount) <= 0)}
                helperText={
                  error && (!amount.trim() || parseFloat(amount) <= 0)
                    ? error
                    : `Enter the amount you want to add to your ${currency} account`
                }
                inputProps={{
                  min: 0,
                  step: 0.01,
                }}
                disabled={paymentMethod === 'credit-card'}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{showResult ? 'Close' : 'Cancel'}</Button>
        {!showResult && (
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={
              loading ||
              !phoneNumber.trim() ||
              !amount.trim() ||
              paymentMethod === 'credit-card'
            }
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading
              ? 'Processing...'
              : paymentMethod === 'credit-card'
              ? 'Not Available'
              : 'Send Payment Request'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TopUpModal;
