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
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from '../common/PhoneInput';

type PaymentMethod = 'mtn-momo' | 'airtel-money' | 'moov-money' | 'credit-card';

const MIN_TOP_UP_AMOUNT = 150;

function resolveTopUpCountry(
  phoneE164: string,
  countryFromSelector: 'CM' | 'GA'
): 'CM' | 'GA' {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.startsWith('241')) return 'GA';
  if (digits.startsWith('237')) return 'CM';
  return countryFromSelector;
}

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
  const [phoneCountry, setPhoneCountry] = useState<'CM' | 'GA'>('CM');

  // Lock payment method to Airtel Money only
  const [paymentMethod] = useState<PaymentMethod>('airtel-money');

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
      setPhoneCountry('CM');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!userPhoneNumber) {
      setPhoneCountry('CM');
      return;
    }
    const digits = userPhoneNumber.replace(/\D/g, '');
    if (digits.startsWith('241')) setPhoneCountry('GA');
    else if (digits.startsWith('237')) setPhoneCountry('CM');
  }, [open, userPhoneNumber]);

  // Get phone number hint for Airtel Money
  const getPhoneNumberHint = () => {
    return 'Enter phone number without country code (e.g., 062040404)';
  };

  const handleConfirm = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amountValue = parseFloat(amount);
    if (amountValue < MIN_TOP_UP_AMOUNT) {
      setError(
        t(
          'accounts.minTopUpAmount',
          'Amount must be greater than or equal to {{min}} {{currency}}',
          { min: MIN_TOP_UP_AMOUNT, currency }
        )
      );
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
        setSuccess(t('accounts.paymentMessages.airtelMoneySuccess'));
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

  const parsedTopUpAmount = parseFloat(amount);
  const topUpAmountOk =
    Number.isFinite(parsedTopUpAmount) &&
    parsedTopUpAmount >= MIN_TOP_UP_AMOUNT;

  const topUpMarketCountry = resolveTopUpCountry(phoneNumber, phoneCountry);
  const topUpInfoMessage =
    topUpMarketCountry === 'CM'
      ? t(
          'accounts.paymentMessages.topUpInfoCM',
          'Top up using MTN Mobile Money or Orange Money.'
        )
      : t(
          'accounts.paymentMessages.topUpInfoGA',
          'Top up using Airtel Money or Moov Money.'
        );

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
              <Typography variant="body2">{topUpInfoMessage}</Typography>
            </Alert>
          )}

          {/* Form - only show when no result is displayed */}
          {!showResult && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <PhoneInput
                value={phoneNumber}
                onChange={(value) => setPhoneNumber(value || '')}
                onCountryChange={(c) => {
                  if (c === 'CM' || c === 'GA') setPhoneCountry(c);
                }}
                label={t('accounts.phoneNumber', 'Phone Number')}
                placeholder={getPhoneNumberHint()}
                required
                error={!!error && !phoneNumber.trim()}
                helperText={
                  error && !phoneNumber.trim() ? error : getPhoneNumberHint()
                }
                disabled={false}
                defaultCountry="CM"
                onlyCountries={['CM', 'GA']}
              />

              <TextField
                fullWidth
                label={`Amount (${currency})`}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount to top up"
                required
                error={
                  !!error &&
                  (!amount.trim() ||
                    parseFloat(amount) <= 0 ||
                    parseFloat(amount) < MIN_TOP_UP_AMOUNT)
                }
                helperText={
                  error &&
                  (!amount.trim() ||
                    parseFloat(amount) <= 0 ||
                    parseFloat(amount) < MIN_TOP_UP_AMOUNT)
                    ? error
                    : t(
                        'accounts.topUpAmountHelper',
                        'Enter an amount of at least {{min}} to add to your {{currency}} account',
                        { min: MIN_TOP_UP_AMOUNT, currency }
                      )
                }
                inputProps={{
                  min: MIN_TOP_UP_AMOUNT,
                  step: 0.01,
                }}
                disabled={false}
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
              loading || !phoneNumber.trim() || !amount.trim() || !topUpAmountOk
            }
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Processing...' : 'Send Payment Request'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TopUpModal;
