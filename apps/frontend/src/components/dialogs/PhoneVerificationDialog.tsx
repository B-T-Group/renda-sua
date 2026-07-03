import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTwilioVerify } from '../../hooks/useTwilioVerify';

interface PhoneVerificationDialogProps {
  open: boolean;
  phoneNumber: string;
  onClose: () => void;
  onVerified: () => void;
}

type VerificationStep = 'confirm' | 'code-entry' | 'success';

export function PhoneVerificationDialog({
  open,
  phoneNumber,
  onClose,
  onVerified,
}: PhoneVerificationDialogProps) {
  const { t } = useTranslation();
  const { startVerification, verifyCode, loading, error, reset } = useTwilioVerify();
  const [step, setStep] = useState<VerificationStep>('confirm');
  const [code, setCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep('confirm');
      setCode('');
      setResendCountdown(0);
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleSendCode = async () => {
    try {
      await startVerification(phoneNumber, 'sms');
      setStep('code-entry');
      setResendCountdown(60);
    } catch {
      // Error is handled by the hook and displayed via the error state
    }
  };

  const handleVerifyCode = async () => {
    try {
      const result = await verifyCode(phoneNumber, code);
      if (result.valid) {
        setStep('success');
        setTimeout(() => {
          onVerified();
          onClose();
        }, 1500);
      }
    } catch {
      // Error is handled by the hook and displayed via the error state
    }
  };

  const handleResend = async () => {
    try {
      await startVerification(phoneNumber, 'sms');
      setCode('');
      setResendCountdown(60);
    } catch {
      // Error is handled by the hook and displayed via the error state
    }
  };

  const maskPhoneNumber = (phone: string): string => {
    if (phone.length < 4) return phone;
    return `***${phone.slice(-4)}`;
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('profile.phoneVerifyDialogTitle', 'Verify your phone number')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {step === 'confirm' && (
            <>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'profile.phoneVerifyConfirmMessage',
                  'We will send a verification code to:'
                )}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {phoneNumber}
              </Typography>
            </>
          )}

          {step === 'code-entry' && (
            <>
              <Typography variant="body2" color="text.secondary">
                {t('profile.phoneVerifyCodeMessage', 'Enter the 6-digit code sent to')} {maskPhoneNumber(phoneNumber)}
              </Typography>
              <TextField
                label={t('profile.phoneVerifyCodeLabel', 'Verification code')}
                placeholder={t('profile.phoneVerifyCodePlaceholder', '6-digit code')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                fullWidth
                disabled={loading}
                autoFocus
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  size="small"
                  onClick={handleResend}
                  disabled={resendCountdown > 0 || loading}
                >
                  {resendCountdown > 0
                    ? t('profile.phoneVerifyResendIn', 'Resend in {{seconds}}s', {
                        seconds: resendCountdown,
                      })
                    : t('profile.phoneVerifyResend', 'Resend code')}
                </Button>
              </Box>
            </>
          )}

          {step === 'success' && (
            <Alert severity="success">
              {t('profile.phoneVerifySuccess', 'Phone number verified successfully')}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || step === 'success'}>
          {step === 'success' ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
        </Button>
        {step === 'confirm' && (
          <Button
            onClick={handleSendCode}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : undefined}
          >
            {t('profile.phoneVerifySendCode', 'Send verification code')}
          </Button>
        )}
        {step === 'code-entry' && (
          <Button
            onClick={handleVerifyCode}
            variant="contained"
            disabled={code.length !== 6 || loading}
            startIcon={loading ? <CircularProgress size={20} /> : undefined}
          >
            {t('profile.phoneVerifySubmit', 'Verify')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
