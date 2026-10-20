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
import {
  TogoOperatorPicker,
  TogoOperator,
  detectTogoOperator,
} from '../common/TogoOperatorPicker';
import { useMobilePaymentProviders } from '../../hooks/useMobilePaymentProviders';
import { getCountryCodeFromE164 } from '../../utils/phoneUtils';

type PaymentMethod = 'mtn-momo' | 'airtel-money' | 'moov-money' | 'fedapay' | 'credit-card';

const MIN_TOP_UP_AMOUNT = 150;

function resolveTopUpCountry(
  phoneE164: string,
  countryFromSelector: 'CM' | 'GA' | 'TG'
): 'CM' | 'GA' | 'TG' {
  const detected = getCountryCodeFromE164(phoneE164);
  return detected || countryFromSelector;
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
  const [phoneCountry, setPhoneCountry] = useState<'CM' | 'GA' | 'TG'>('CM');
  const [togoOperator, setTogoOperator] = useState<TogoOperator>('togocel');
  const [operatorMismatch, setOperatorMismatch] = useState(false);

  // Check if FedaPay is available for Togo
  const { isFedaPayAvailable, loading: providersLoading, error: providersError } = useMobilePaymentProviders(
    phoneCountry === 'TG' ? 'TG' : undefined
  );

  // Determine payment method based on country
  const [paymentMethod] = useState<PaymentMethod>('airtel-money');

  // Auto-detect operator from phone number and check for mismatch
  useEffect(() => {
    if (phoneNumber && phoneCountry === 'TG') {
      const detected = detectTogoOperator(phoneNumber);
      const mismatch = togoOperator !== detected;
      setOperatorMismatch(mismatch);
    } else {
      setOperatorMismatch(false);
    }
  }, [phoneNumber, phoneCountry, togoOperator]);

  // Update phone number when userPhoneNumber prop changes
  useEffect(() => {
    if (userPhoneNumber) {
      setPhoneNumber(userPhoneNumber);
      // Auto-detect operator for Togo numbers
      const country = getCountryCodeFromE164(userPhoneNumber);
      if (country === 'TG') {
        setTogoOperator(detectTogoOperator(userPhoneNumber));
      }
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
    const country = getCountryCodeFromE164(userPhoneNumber);
    if (country) {
      setPhoneCountry(country);
      if (country === 'TG') {
        // Auto-set operator to match phone number
        setTogoOperator(detectTogoOperator(userPhoneNumber));
      }
    } else {
      setPhoneCountry('CM');
    }
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
      // Determine actual payment method based on country
      const topUpCountry = resolveTopUpCountry(phoneNumber, phoneCountry);
      const actualPaymentMethod = topUpCountry === 'TG' ? 'fedapay' : paymentMethod;
      
      const success = await onConfirm(phoneNumber, amount, actualPaymentMethod);

      if (success) {
        const successMessage = topUpCountry === 'TG'
          ? t('accounts.paymentMessages.fedapaySuccess', 'Payment request sent successfully via FedaPay.')
          : t('accounts.paymentMessages.airtelMoneySuccess');
        setSuccess(successMessage);
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
  
  // Check if FedaPay is unavailable for Togo
  const isFedaPayUnavailable = topUpMarketCountry === 'TG' && (!isFedaPayAvailable || !!providersError);
  
  const canSubmit = !operatorMismatch && topUpAmountOk && !!phoneNumber.trim() && !!amount.trim() && !isFedaPayUnavailable;
  const topUpInfoMessage =
    topUpMarketCountry === 'TG'
      ? t(
          'accounts.paymentMessages.topUpInfoTG',
          'Top up using Moov Money or Mixx by Yas (Togocel).'
        )
      : topUpMarketCountry === 'CM'
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
                onChange={(value) => {
                  setPhoneNumber(value || '');
                  // Auto-update operator to match phone prefix
                  const country = getCountryCodeFromE164(value || '');
                  if (country === 'TG') {
                    setTogoOperator(detectTogoOperator(value || ''));
                  }
                }}
                onCountryChange={(c) => {
                  if (c === 'CM' || c === 'GA' || c === 'TG') {
                    setPhoneCountry(c);
                  }
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
                onlyCountries={['CM', 'GA', 'TG']}
              />

              {/* Show unavailable state when FedaPay is not available for Togo */}
              {phoneCountry === 'TG' && isFedaPayUnavailable && !providersLoading && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    {t(
                      'payment.togoOperator.unavailable',
                      'FedaPay mobile money is not currently available for Togo. Please try again later or contact support.'
                    )}
                  </Typography>
                </Alert>
              )}

              {/* Show Togo operator picker only when country is TG and FedaPay is active */}
              {phoneCountry === 'TG' && isFedaPayAvailable && !providersError && (
                <>
                  <TogoOperatorPicker
                    value={togoOperator}
                    onChange={setTogoOperator}
                    phoneNumber={phoneNumber}
                    disabled={false}
                  />
                  {operatorMismatch && phoneNumber.trim() && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        {t(
                          'payment.togoOperator.mismatch',
                          'The selected operator does not match the phone number prefix. Please select the correct operator or update the phone number.'
                        )}
                      </Typography>
                    </Alert>
                  )}
                </>
              )}

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
            color="cta"
            disabled={loading || !canSubmit}
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
