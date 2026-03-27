import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useApiClient } from '../../hooks/useApiClient';
import Logo from '../common/Logo';

const OtpAuthPage: React.FC = () => {
  const apiClient = useApiClient();
  const { setPasswordlessSession } = useSessionAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const flow = search.get('flow') || 'login';
  const initialEmail = useMemo(() => {
    const key = flow === 'signup' ? 'pendingSignupEmail' : 'pendingLoginEmail';
    return sessionStorage.getItem(key) || '';
  }, [flow]);
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(Array.from({ length: 6 }, () => ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    const key =
      flow === 'signup'
        ? 'pendingSignupOtpExpiresAtMs'
        : 'pendingLoginOtpExpiresAtMs';
    const stored = sessionStorage.getItem(key);
    const expiresAt = stored ? Number(stored) : Date.now() + 5 * 60 * 1000;
    return Math.max(0, expiresAt - Date.now());
  });

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const otp = useMemo(() => digits.join(''), [digits]);
  const isExpired = remainingMs <= 0;
  const minutes = Math.floor(remainingMs / 1000 / 60);
  const seconds = Math.floor((remainingMs / 1000) % 60);
  const timerLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const handleDigitChange = (idx: number, next: string) => {
    const value = next.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
    if (value && inputRefs.current[idx + 1]) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key !== 'Backspace') return;
    if (digits[idx]) {
      setDigits((prev) => {
        const copy = [...prev];
        copy[idx] = '';
        return copy;
      });
      return;
    }
    if (inputRefs.current[idx - 1]) {
      inputRefs.current[idx - 1]?.focus();
      setDigits((prev) => {
        const copy = [...prev];
        copy[idx - 1] = '';
        return copy;
      });
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    const onlyDigits = text.replace(/\D/g, '').slice(0, 6);
    if (!onlyDigits) return;
    e.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, i) => onlyDigits[i] || ''));
    const nextIndex = Math.min(onlyDigits.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      if (flow === 'signup') {
        const userId = sessionStorage.getItem('pendingSignupUserId') || undefined;
        await apiClient.post('/auth/signup/verify-otp', { email, otp, userId });
        navigate('/');
        return;
      }

      const res = await apiClient.post('/auth/login/verify-otp', { email, otp });
      setPasswordlessSession(res.data);
      await apiClient.get('/users/me');
      navigate('/app');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          t('auth.otpLogin.invalidOtp', 'Invalid OTP. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Logo variant="default" size="medium" />
          <Typography variant="h4">
            {flow === 'signup'
              ? t('auth.otpSignup.title', 'Verify your account')
              : t('auth.otpLogin.titleShort', 'Log in with OTP')}
          </Typography>
          <Typography color="text.secondary">
            {t('auth.otp.enterCode', 'Enter the OTP sent to your email.')}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              bgcolor: 'action.hover',
              px: 2,
              py: 1,
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('auth.otp.expiresIn', 'Expires in')} {timerLabel}
            </Typography>
            {isExpired ? (
              <Typography variant="body2" color="error.main">
                {t('auth.otp.expired', 'Code expired')}
              </Typography>
            ) : null}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label={t('auth.emailAddressLabel', 'Email address')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={flow !== 'signup'}
          />
          <Box
            onPaste={handlePaste}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
          >
            {digits.map((d, idx) => (
              <TextField
                key={idx}
                value={d}
                inputRef={(el) => {
                  inputRefs.current[idx] = el;
                }}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                inputProps={{
                  inputMode: 'numeric',
                  maxLength: 1,
                  style: { textAlign: 'center', fontSize: 20, fontWeight: 700 },
                }}
                sx={{ width: 52 }}
              />
            ))}
          </Box>
          <Button
            variant="contained"
            size="large"
            onClick={handleVerify}
            disabled={loading || !email.trim() || otp.length !== 6 || isExpired}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            {loading
              ? t('auth.otp.verifying', 'Verifying...')
              : t('auth.otp.verify', 'Verify OTP')}
          </Button>
          <Button onClick={() => navigate('/')}>
            {t('auth.otp.backToHome', 'Back to home')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default OtpAuthPage;
