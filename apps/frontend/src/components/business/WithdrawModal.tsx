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

const MIN_WITHDRAW_AMOUNT = 150;

function isCmOrGaPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('237')) {
    return digits.length >= 12;
  }
  if (digits.startsWith('241')) {
    return digits.length >= 11;
  }
  return false;
}

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
  /** When set, shown as helper text under the phone field (e.g. for location account withdrawals). */
  withdrawalPhoneNote?: string;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  open,
  onClose,
  onConfirm,
  userPhoneNumber,
  currency,
  availableBalance,
  loading = false,
  withdrawalPhoneNote,
}) => {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResult, setShowResult] = useState(false);

  const [paymentMethod] = useState<PaymentMethod>('airtel-money');

  useEffect(() => {
    if (userPhoneNumber) {
      setPhoneNumber(userPhoneNumber);
    }
  }, [userPhoneNumber]);

  useEffect(() => {
    if (!open) {
      setError('');
      setSuccess('');
      setShowResult(false);
      setAmount('');
    }
  }, [open]);

  const note = withdrawalPhoneNote ?? '';
  const cmGaHint = t(
    'accounts.withdrawPhoneCmGaHint',
    'Use a Cameroon (+237) or Gabon (+241) mobile number.'
  );
  const getPhoneNumberHint = () =>
    [note, cmGaHint].filter(Boolean).join(' ') || cmGaHint;

  const handleConfirm = async () => {
    if (!phoneNumber.trim()) {
      setError(t('accounts.phoneNumberRequired'));
      return;
    }

    if (!isCmOrGaPhone(phoneNumber)) {
      setError(
        t(
          'accounts.withdrawPhoneCmGaOnly',
          'Only Cameroon (+237) or Gabon (+241) phone numbers are supported.'
        )
      );
      return;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      setError(t('accounts.amountRequired'));
      return;
    }

    const amountValue = parseFloat(amount);
    if (amountValue < MIN_WITHDRAW_AMOUNT) {
      setError(
        t(
          'accounts.minWithdrawAmount',
          'Withdrawal amount must be greater than or equal to {{min}} {{currency}}',
          { min: MIN_WITHDRAW_AMOUNT, currency }
        )
      );
      return;
    }

    if (amountValue > availableBalance) {
      setError(t('accounts.insufficientFunds'));
      return;
    }

    setError('');
    setSuccess('');

    try {
      const ok = await onConfirm(phoneNumber, amount, paymentMethod);
      if (ok) {
        setSuccess(t('accounts.withdrawRequestSent'));
        setShowResult(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(t('accounts.withdrawFailed'));
      }
    } catch {
      setError(t('accounts.withdrawFailed'));
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const parsedAmount = parseFloat(amount);
  const amountOk =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_WITHDRAW_AMOUNT &&
    parsedAmount <= availableBalance;
  const balanceAllowsWithdraw = availableBalance >= MIN_WITHDRAW_AMOUNT;
  const phoneOk = phoneNumber.trim() && isCmOrGaPhone(phoneNumber);
  const canSubmit =
    balanceAllowsWithdraw &&
    phoneOk &&
    amountOk &&
    !loading &&
    !showResult;

  const amountNumericInvalid =
    !amount.trim() ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount < MIN_WITHDRAW_AMOUNT ||
    parsedAmount > availableBalance;
  const amountFieldError = !!error && amountNumericInvalid;

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

            {!balanceAllowsWithdraw && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t(
                  'accounts.withdrawBalanceBelowMin',
                  'You need at least {{min}} {{currency}} available to withdraw.',
                  { min: MIN_WITHDRAW_AMOUNT, currency }
                )}
              </Alert>
            )}

            <PhoneInput
              value={phoneNumber}
              onChange={(value) => setPhoneNumber(value || '')}
              label={t('accounts.phoneNumber')}
              placeholder={t('accounts.phoneNumberPlaceholder')}
              helperText={getPhoneNumberHint()}
              disabled={loading || !balanceAllowsWithdraw}
              defaultCountry="CM"
              onlyCountries={['CM', 'GA']}
            />

            <TextField
              fullWidth
              label={t('accounts.amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder={t('accounts.amountPlaceholder')}
              error={amountFieldError}
              helperText={
                amountFieldError
                  ? error
                  : t(
                      'accounts.withdrawAmountHelper',
                      'Minimum withdrawal: {{min}} {{currency}}',
                      { min: MIN_WITHDRAW_AMOUNT, currency }
                    )
              }
              inputProps={{
                min: MIN_WITHDRAW_AMOUNT,
                max: availableBalance,
                step: 0.01,
              }}
              sx={{ mb: 2, mt: 1 }}
              disabled={loading || !balanceAllowsWithdraw}
            />

            {error && !amountFieldError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

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
          disabled={!canSubmit}
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
