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

type PaymentMethod = 'mtn-momo' | 'airtel-money' | 'moov-money' | 'credit-card';

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    phoneNumber: string,
    amount: string,
    paymentMethod: PaymentMethod
  ) => Promise<boolean>;
  userPhoneNumber?: string;
  currency: string;
  availableBalance: number;
  loading?: boolean;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  open,
  onClose,
  onConfirm,
  userPhoneNumber,
  currency,
  availableBalance,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResult, setShowResult] = useState(false);

  // Set default payment method based on currency
  const getDefaultPaymentMethod = (): PaymentMethod => {
    if (currency === 'XAF') {
      return 'airtel-money';
    }
    return 'mtn-momo';
  };

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    getDefaultPaymentMethod()
  );

  // Update default payment method when currency changes
  useEffect(() => {
    setPaymentMethod(getDefaultPaymentMethod());
  }, [currency]);

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

  // Get available payment methods based on currency
  const getAvailablePaymentMethods = () => {
    if (currency === 'XAF') {
      return [
        {
          value: 'airtel-money',
          label: t('accounts.paymentMethods.airtelMoney'),
        },
        { value: 'moov-money', label: t('accounts.paymentMethods.moovMoney') },
        {
          value: 'credit-card',
          label: t('accounts.paymentMethods.creditCardComingSoon'),
          disabled: true,
        },
      ];
    }
    return [
      { value: 'mtn-momo', label: t('accounts.paymentMethods.mtnMomo') },
      {
        value: 'airtel-money',
        label: t('accounts.paymentMethods.airtelMoney'),
      },
      { value: 'moov-money', label: t('accounts.paymentMethods.moovMoney') },
    ];
  };

  // Get phone number hint based on payment method
  const getPhoneNumberHint = () => {
    if (paymentMethod === 'airtel-money' || paymentMethod === 'moov-money') {
      return t('accounts.phoneNumberHint');
    }
    return '';
  };

  const availablePaymentMethods = getAvailablePaymentMethods();

  const handleConfirm = async () => {
    if (!phoneNumber.trim()) {
      setError(t('accounts.phoneNumberRequired'));
      return;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      setError(t('accounts.amountRequired'));
      return;
    }

    const amountValue = parseFloat(amount);
    if (amountValue > availableBalance) {
      setError(t('accounts.insufficientFunds'));
      return;
    }

    setError('');
    setSuccess('');

    try {
      const success = await onConfirm(phoneNumber, amount, paymentMethod);
      if (success) {
        setSuccess(t('accounts.withdrawRequestSent'));
        setShowResult(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(t('accounts.withdrawFailed'));
      }
    } catch (error) {
      setError(t('accounts.withdrawFailed'));
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{t('accounts.withdrawRequest')}</Typography>
          <IconButton onClick={handleClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {showResult ? (
          <Box textAlign="center" py={2}>
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          </Box>
        ) : (
          <Box sx={{ pt: 1 }}>
            {/* Available Balance Display */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('accounts.availableBalance')}
              </Typography>
              <Typography variant="h5" color="success.main" fontWeight="bold">
                {formatCurrency(availableBalance)}
              </Typography>
            </Box>

            {/* Payment Method Selection */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>{t('accounts.paymentMethod')}</InputLabel>
              <Select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                label={t('accounts.paymentMethod')}
                disabled={loading}
              >
                {availablePaymentMethods.map((method) => (
                  <MenuItem
                    key={method.value}
                    value={method.value}
                    disabled={method.disabled}
                  >
                    {method.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Phone Number Input */}
            <TextField
              fullWidth
              label={t('accounts.phoneNumber')}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={t('accounts.phoneNumberPlaceholder')}
              helperText={getPhoneNumberHint()}
              sx={{ mb: 3 }}
              disabled={loading}
            />

            {/* Amount Input */}
            <TextField
              fullWidth
              label={t('accounts.amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder={t('accounts.amountPlaceholder')}
              inputProps={{
                min: 0,
                max: availableBalance,
                step: 0.01,
              }}
              sx={{ mb: 3 }}
              disabled={loading}
            />

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Success Display */}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={loading || showResult}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          sx={{
            background: 'linear-gradient(45deg, #FF5722 30%, #FF7043 90%)',
            color: 'white',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: '0 3px 5px 2px rgba(255, 87, 34, .3)',
            '&:hover': {
              background: 'linear-gradient(45deg, #D84315 30%, #FF5722 90%)',
              boxShadow: '0 4px 8px 2px rgba(255, 87, 34, .4)',
            },
            '&:disabled': {
              background: 'linear-gradient(45deg, #9E9E9E 30%, #BDBDBD 90%)',
              boxShadow: 'none',
            },
          }}
        >
          {loading ? t('common.processing') : t('accounts.withdraw')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WithdrawModal;
