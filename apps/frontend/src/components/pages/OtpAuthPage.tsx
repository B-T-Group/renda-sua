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
import { validateReturnTo } from '../../utils/returnToValidator';
import LaunchPromoCongrats, {
  LaunchPromoCongratsData,
} from '../business/LaunchPromoCongrats';
import { clearSignupDraft } from '../signup/wizard/useSignupDraft';
import Logo from '../common/Logo';

const OTP_LENGTH = 4;

const OtpAuthPage: React.FC = () => {
  const apiClient = useApiClient();
  const { setPasswordlessSession } = useSessionAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const flow = search.get('flow') || 'login';
  const isSignup = flow === 'signup';
  const attemptId = useMemo(
    () => sessionStorage.getItem('pendingSignupAttemptId') || '',
    []
  );
  const channel = useMemo(
    () => {
      if (isSignup) {
        return (sessionStorage.getItem('pendingSignupOtpChannel') as 'email' | 'sms' | null) ||
          (sessionStorage.getItem('pendingSignupPhone') ? 'sms' : 'email');
      }
      // Login flow: check for pendingLoginPhone
      return sessionStorage.getItem('pendingLoginPhone') ? 'sms' : 'email';
    },
    [isSignup]
  );
  const initialEmail = useMemo(() => {
    const key = isSignup ? 'pendingSignupEmail' : 'pendingLoginEmail';
    return sessionStorage.getItem(key) || '';
  }, [isSignup]);
  const initialPhone = useMemo(() => {
    const key = isSignup ? 'pendingSignupPhone' : 'pendingLoginPhone';
    return sessionStorage.getItem(key) || '';
  }, [isSignup]);
  const maskedDestination = useMemo(() => {
    const dest = sessionStorage.getItem('pendingLoginDestination') || initialEmail;
    if (dest.includes('@')) {
      const [local, domain] = dest.split('@');
      return `${local.slice(0, 2)}***@${domain}`;
    }
    if (dest.length > 6) {
      return `***${dest.slice(-4)}`;
    }
    return dest;
  }, [initialEmail]);
  const returnTo = useMemo(
    () => validateReturnTo(sessionStorage.getItem('pendingLoginReturnTo') || '/app'),
    []
  );
  const [email] = useState(initialEmail);
  const [resendCooldownMs, setResendCooldownMs] = useState(0);
  const [digits, setDigits] = useState<string[]>(
    Array.from({ length: OTP_LENGTH }, () => '')
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
      setResendCooldownMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const otp = useMemo(() => digits.join(''), [digits]);
  const isExpired = remainingMs <= 0;
  const minutes = Math.floor(remainingMs / 1000 / 60);
  const seconds = Math.floor((remainingMs / 1000) % 60);
  const timerLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const isOtpComplete = useMemo(
    () => otp.length === OTP_LENGTH && /^\d{4}$/.test(otp),
    [otp]
  );

  useEffect(() => {
    if (isOtpComplete && !loading && !isExpired) {
      void handleVerify();
    }
  }, [isOtpComplete]);

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
    const onlyDigits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!onlyDigits) return;
    e.preventDefault();
    setDigits(Array.from({ length: OTP_LENGTH }, (_, i) => onlyDigits[i] || ''));
    const nextIndex = Math.min(onlyDigits.length, OTP_LENGTH - 1);
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

      const payload = initialEmail
        ? { email: initialEmail, otp }
        : initialPhone
          ? { phone_number: initialPhone, otp }
          : { email, otp };
      const res = await apiClient.post('/auth/login/verify-otp', payload);
      setPasswordlessSession(res.data);
      await apiClient.get('/users/me');
      sessionStorage.removeItem('pendingLoginEmail');
      sessionStorage.removeItem('pendingLoginPhone');
      sessionStorage.removeItem('pendingLoginDestination');
      sessionStorage.removeItem('pendingLoginReturnTo');
      sessionStorage.removeItem('pendingLoginOtpExpiresAtMs');
      // Validate returnTo before navigation
      const validatedReturnTo = validateReturnTo(returnTo);
      navigate(validatedReturnTo);
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
    if (resendBusy || isExpired || resendCooldownMs > 0) return;
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
        setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
        setResendCooldownMs(120 * 1000);
        return;
      }
      const payload = initialEmail ? { email: initialEmail } : initialPhone ? { phone_number: initialPhone } : { email };
      await apiClient.post('/auth/login/start-otp', payload);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      setResendCooldownMs(120 * 1000);
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

  const resendCooldownSec = Math.ceil(resendCooldownMs / 1000);

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Logo variant="default" size="medium" />
          <Typography variant="h4">
            {t('auth.otp.verificationTitle', 'Enter verification code')}
          </Typography>
          <Typography color="text.secondary">
            {isSignup && channel === 'sms'
              ? t('auth.otp.enterCodeSms', 'Enter the code sent to {{phone}}.', {
                  phone: contactLabel,
                })
              : isSignup
                ? t('auth.otp.enterCode', 'Enter the code sent to your email.')
                : channel === 'sms' && initialPhone
                  ? t('auth.otp.loginCodeSms', 'We sent a 4-digit code to {{phone}}.', { phone: maskedDestination })
                  : t('auth.otp.loginCodeEmail', 'We sent a 4-digit code to {{email}}.', { email: maskedDestination })}
          </Typography>
          {!isSignup && channel === 'sms' && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {t('auth.otp.smsMayTake', 'SMS delivery may take 30-60 seconds.')}
            </Typography>
          )}
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
            disabled={loading || otp.length < OTP_LENGTH || isExpired}
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
            disabled={resendBusy || isExpired || resendCooldownMs > 0}
            onClick={() => void handleResend()}
          >
            {resendBusy
              ? t('common.loading', 'Loading…')
              : resendCooldownMs > 0
                ? t('auth.otp.resendIn', 'Resend in {{seconds}}s', { seconds: resendCooldownSec })
                : t('auth.otp.resend', 'Resend code')}
          </Button>
          <Button color="inherit" onClick={() => navigate(isSignup ? '/signup' : '/')}>
            {isSignup && channel === 'sms'
              ? t('auth.otp.changeNumber', 'Change phone number')
              : isSignup
                ? t('auth.otp.changeEmail', 'Change email')
                : t('auth.otp.changeContact', 'Use a different email or phone')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default OtpAuthPage;
