import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useApiClient } from '../../hooks/useApiClient';
import LaunchPromoCongrats, {
  LaunchPromoCongratsData,
} from '../business/LaunchPromoCongrats';
import { clearSignupDraft } from '../signup/wizard/useSignupDraft';
import Logo from '../common/Logo';

const OtpAuthPage: React.FC = () => {
  const apiClient = useApiClient();
  const { setPasswordlessSession } = useSessionAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const flow = search.get('flow') || 'login';
  const emailFromQuery = search.get('email') || '';
  const isSignup = flow === 'signup';
  const attemptId = useMemo(
    () => sessionStorage.getItem('pendingSignupAttemptId') || '',
    []
  );
  const channel = useMemo(
    () =>
      (sessionStorage.getItem('pendingSignupOtpChannel') as
        | 'email'
        | 'sms'
        | null) ||
      (sessionStorage.getItem('pendingSignupPhone') ? 'sms' : 'email'),
    []
  );
  const initialEmail = useMemo(() => {
    if (emailFromQuery) {
      sessionStorage.setItem('pendingLoginEmail', emailFromQuery);
      return emailFromQuery;
    }
    const key = isSignup ? 'pendingSignupEmail' : 'pendingLoginEmail';
    return sessionStorage.getItem(key) || '';
  }, [emailFromQuery, isSignup]);
  const initialPhone = useMemo(
    () => (isSignup ? sessionStorage.getItem('pendingSignupPhone') || '' : ''),
    [isSignup]
  );
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(
    Array.from({ length: 6 }, () => '')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [launchPromo, setLaunchPromo] =
    useState<LaunchPromoCongratsData | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    const key = isSignup
      ? 'pendingSignupOtpExpiresAtMs'
      : 'pendingLoginOtpExpiresAtMs';
    const stored = sessionStorage.getItem(key);
    const expiresAt = stored ? Number(stored) : Date.now() + 15 * 60 * 1000;
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

  const clearSignupSession = () => {
    sessionStorage.removeItem('pendingSignupAttemptId');
    sessionStorage.removeItem('pendingSignupEmail');
    sessionStorage.removeItem('pendingSignupPhone');
    sessionStorage.removeItem('pendingSignupOtpChannel');
    sessionStorage.removeItem('pendingSignupOtpExpiresAtMs');
    sessionStorage.removeItem('pendingSignupUserId');
  };

  const goToApp = () => {
    sessionStorage.removeItem('pendingSignupLaunchPromo');
    navigate('/app');
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSignup) {
        if (!attemptId) {
          setError(
            t(
              'auth.signupFlow.attemptMissing',
              'Verification session expired. Please start signup again.'
            )
          );
          return;
        }
        const res = await apiClient.post('/auth/signup/verify-otp', {
          attemptId,
          otp,
        });
        setPasswordlessSession(res.data);
        clearSignupDraft();
        clearSignupSession();
        await apiClient.get('/users/me');
        const promo = res.data?.launchPromo as LaunchPromoCongratsData | null;
        if (promo) {
          setLaunchPromo(promo);
          try {
            sessionStorage.setItem(
              'pendingSignupLaunchPromo',
              JSON.stringify(promo)
            );
          } catch {
            // ignore
          }
          return;
        }
        navigate('/app');
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

  const handleResend = async () => {
    if (resendBusy || isExpired) return;
    setResendBusy(true);
    setError(null);
    try {
      if (isSignup) {
        if (!attemptId) {
          setError(
            t(
              'auth.signupFlow.attemptMissing',
              'Verification session expired. Please start signup again.'
            )
          );
          return;
        }
        const res = await apiClient.post('/auth/signup/resend-otp', {
          attemptId,
        });
        if (res.data?.expiresAt) {
          sessionStorage.setItem(
            'pendingSignupOtpExpiresAtMs',
            String(
              Date.parse(res.data.expiresAt) || Date.now() + 15 * 60 * 1000
            )
          );
          setRemainingMs(
            Math.max(0, Date.parse(res.data.expiresAt) - Date.now())
          );
        }
        setDigits(Array.from({ length: 6 }, () => ''));
        return;
      }
      await apiClient.post('/auth/login/start-otp', { email });
      setDigits(Array.from({ length: 6 }, () => ''));
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          t('auth.otp.resendFailed', 'Could not resend code. Please try again.')
      );
    } finally {
      setResendBusy(false);
    }
  };

  const contactLabel =
    channel === 'sms' && initialPhone
      ? initialPhone
      : email || t('auth.emailAddressLabel', 'Email address');

  if (launchPromo) {
    return (
      <Container maxWidth="sm" sx={{ py: 5 }}>
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={2.5}>
            <Logo variant="default" size="medium" />
            <Typography variant="h4">
              {t('auth.otpSignup.successTitle', 'Account verified')}
            </Typography>
            <LaunchPromoCongrats promo={launchPromo} />
            <Button variant="contained" size="large" onClick={goToApp}>
              {t('common.continue', 'Continue')}
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Logo variant="default" size="medium" />
          <Typography variant="h4">
            {isSignup
              ? t('auth.otpSignup.title', 'Verify your contact')
              : t('auth.otpLogin.titleShort', 'Log in with OTP')}
          </Typography>
          <Typography color="text.secondary">
            {channel === 'sms'
              ? t('auth.otp.enterCodeSms', 'Enter the OTP sent to {{phone}}.', {
                  phone: contactLabel,
                })
              : t('auth.otp.enterCode', 'Enter the OTP sent to your email.')}
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
          {!isSignup || channel === 'email' ? (
            <TextField
              label={t('auth.emailAddressLabel', 'Email address')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSignup}
            />
          ) : null}
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
                sx={{ width: 48 }}
              />
            ))}
          </Box>
          <Button
            variant="contained"
            size="large"
            disabled={loading || otp.length < 6 || isExpired}
            onClick={() => void handleVerify()}
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              t('common.verify', 'Verify')
            )}
          </Button>
          <Button
            color="inherit"
            disabled={resendBusy || isExpired}
            onClick={() => void handleResend()}
          >
            {resendBusy
              ? t('common.loading', 'Loading…')
              : t('auth.otp.resend', 'Resend code')}
          </Button>
          {isSignup ? (
            <Button color="inherit" onClick={() => navigate('/signup')}>
              {channel === 'sms'
                ? t('auth.otp.changeNumber', 'Change phone number')
                : t('auth.otp.changeEmail', 'Change email')}
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Container>
  );
};

export default OtpAuthPage;
