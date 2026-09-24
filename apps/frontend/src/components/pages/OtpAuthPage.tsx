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
import { useAuthFunnelTracking } from '../../hooks/useAuthFunnelTracking';
import { validateReturnTo } from '../../utils/returnToValidator';
import LaunchPromoCongrats, {
  LaunchPromoCongratsData,
} from '../business/LaunchPromoCongrats';
import { clearSignupDraft } from '../signup/wizard/useSignupDraft';
import Logo from '../common/Logo';
import type { OtpChannelChoice } from '../auth/OtpChannelPicker';

const OTP_LENGTH = 4;

function readChannels(key: string): OtpChannelChoice[] {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is OtpChannelChoice => c === 'email' || c === 'sms'
    );
  } catch {
    return [];
  }
}

function clearLoginSession(): void {
  sessionStorage.removeItem('pendingLoginEmail');
  sessionStorage.removeItem('pendingLoginPhone');
  sessionStorage.removeItem('pendingLoginDestination');
  sessionStorage.removeItem('pendingLoginReturnTo');
  sessionStorage.removeItem('pendingLoginOtpExpiresAtMs');
  sessionStorage.removeItem('pendingLoginOtpChannel');
  sessionStorage.removeItem('pendingLoginAvailableChannels');
  sessionStorage.removeItem('pendingLoginMaskedEmail');
  sessionStorage.removeItem('pendingLoginMaskedPhone');
}

function clearSignupSessionKeys(): void {
  sessionStorage.removeItem('pendingSignupAttemptId');
  sessionStorage.removeItem('pendingSignupEmail');
  sessionStorage.removeItem('pendingSignupPhone');
  sessionStorage.removeItem('pendingSignupOtpChannel');
  sessionStorage.removeItem('pendingSignupOtpExpiresAtMs');
  sessionStorage.removeItem('pendingSignupUserId');
  sessionStorage.removeItem('pendingSignupAvailableChannels');
  sessionStorage.removeItem('pendingSignupMaskedEmail');
  sessionStorage.removeItem('pendingSignupMaskedPhone');
}

const OtpAuthPage: React.FC = () => {
  const apiClient = useApiClient();
  const { trackAuthGateDismissed } = useAuthFunnelTracking('otp_auth_page');
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
  const loginEmail = useMemo(
    () => sessionStorage.getItem('pendingLoginEmail') || '',
    []
  );
  const loginPhone = useMemo(
    () => sessionStorage.getItem('pendingLoginPhone') || '',
    []
  );
  const signupEmail = useMemo(
    () => sessionStorage.getItem('pendingSignupEmail') || '',
    []
  );
  const signupPhone = useMemo(
    () => sessionStorage.getItem('pendingSignupPhone') || '',
    []
  );
  const [channel, setChannel] = useState<OtpChannelChoice>(() => {
    if (isSignup) {
      return (
        (sessionStorage.getItem('pendingSignupOtpChannel') as OtpChannelChoice) ||
        (signupPhone ? 'sms' : 'email')
      );
    }
    return (
      (sessionStorage.getItem('pendingLoginOtpChannel') as OtpChannelChoice) ||
      (loginPhone ? 'sms' : 'email')
    );
  });
  const [availableChannels, setAvailableChannels] = useState<OtpChannelChoice[]>(
    () =>
      readChannels(
        isSignup
          ? 'pendingSignupAvailableChannels'
          : 'pendingLoginAvailableChannels'
      )
  );
  const [maskedEmail, setMaskedEmail] = useState(
    () =>
      sessionStorage.getItem(
        isSignup ? 'pendingSignupMaskedEmail' : 'pendingLoginMaskedEmail'
      ) || ''
  );
  const [maskedPhone, setMaskedPhone] = useState(
    () =>
      sessionStorage.getItem(
        isSignup ? 'pendingSignupMaskedPhone' : 'pendingLoginMaskedPhone'
      ) || ''
  );
  const returnTo = useMemo(
    () =>
      validateReturnTo(sessionStorage.getItem('pendingLoginReturnTo') || '/app'),
    []
  );
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

  const applyDeliveryMeta = (data: {
    channel?: OtpChannelChoice;
    availableChannels?: OtpChannelChoice[];
    maskedEmail?: string;
    maskedPhone?: string;
    expiresAt?: string;
  }) => {
    if (data.channel) {
      setChannel(data.channel);
      sessionStorage.setItem(
        isSignup ? 'pendingSignupOtpChannel' : 'pendingLoginOtpChannel',
        data.channel
      );
    }
    if (data.availableChannels?.length) {
      setAvailableChannels(data.availableChannels);
      sessionStorage.setItem(
        isSignup
          ? 'pendingSignupAvailableChannels'
          : 'pendingLoginAvailableChannels',
        JSON.stringify(data.availableChannels)
      );
    }
    if (data.maskedEmail) {
      setMaskedEmail(data.maskedEmail);
      sessionStorage.setItem(
        isSignup ? 'pendingSignupMaskedEmail' : 'pendingLoginMaskedEmail',
        data.maskedEmail
      );
    }
    if (data.maskedPhone) {
      setMaskedPhone(data.maskedPhone);
      sessionStorage.setItem(
        isSignup ? 'pendingSignupMaskedPhone' : 'pendingLoginMaskedPhone',
        data.maskedPhone
      );
    }
    if (data.expiresAt) {
      const ms = Date.parse(data.expiresAt) || Date.now() + 15 * 60 * 1000;
      sessionStorage.setItem(
        isSignup ? 'pendingSignupOtpExpiresAtMs' : 'pendingLoginOtpExpiresAtMs',
        String(ms)
      );
      setRemainingMs(Math.max(0, ms - Date.now()));
    }
  };

  const goToApp = () => {
    sessionStorage.removeItem('pendingSignupLaunchPromo');
    navigate('/app', { replace: true });
  };

  const showSignupPromo = (promo: LaunchPromoCongratsData) => {
    setLaunchPromo(promo);
    try {
      sessionStorage.setItem(
        'pendingSignupLaunchPromo',
        JSON.stringify(promo)
      );
    } catch {
      // ignore
    }
  };

  const completeSignupVerify = (data: {
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
    launchPromo?: LaunchPromoCongratsData | null;
  }) => {
    setPasswordlessSession(data);
    clearSignupDraft();
    clearSignupSessionKeys();
    if (data.launchPromo) {
      showSignupPromo(data.launchPromo);
      return;
    }
    navigate('/app', { replace: true });
  };

  const completeLoginVerify = (data: {
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
  }) => {
    setPasswordlessSession(data);
    clearLoginSession();
    navigate(validateReturnTo(returnTo), { replace: true });
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
        completeSignupVerify(res.data);
        return;
      }

      if (!loginEmail && !loginPhone) {
        setError(
          t(
            'auth.otpLogin.sessionMissing',
            'Login session expired. Please start again.'
          )
        );
        return;
      }
      const payload = loginEmail
        ? { email: loginEmail, otp, channel }
        : { phone_number: loginPhone, otp, channel };
      const res = await apiClient.post('/auth/login/verify-otp', payload);
      completeLoginVerify(res.data);
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

  const loginIdentifierPayload = ():
    | { email: string }
    | { phone_number: string }
    | null => {
    if (loginEmail) return { email: loginEmail };
    if (loginPhone) return { phone_number: loginPhone };
    return null;
  };

  const handleResend = async (nextChannel?: OtpChannelChoice) => {
    const switching = !!nextChannel && nextChannel !== channel;
    if (resendBusy || isExpired) return;
    if (!switching && resendCooldownMs > 0) return;
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
          ...(nextChannel ? { channel: nextChannel } : {}),
        });
        applyDeliveryMeta(res.data || {});
        setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
        setResendCooldownMs(120 * 1000);
        return;
      }
      const identifier = loginIdentifierPayload();
      if (!identifier) {
        setError(
          t(
            'auth.otpLogin.sessionMissing',
            'Login session expired. Please start again.'
          )
        );
        return;
      }
      const res = await apiClient.post('/auth/login/start-otp', {
        ...identifier,
        channel: nextChannel || channel,
      });
      applyDeliveryMeta({
        channel: res.data?.channel || nextChannel || channel,
        availableChannels: res.data?.availableChannels,
        maskedEmail: res.data?.maskedEmail,
        maskedPhone: res.data?.maskedPhone,
      });
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

  const alternateChannel = availableChannels.find((c) => c !== channel);
  const displayDestination =
    channel === 'sms'
      ? maskedPhone || signupPhone || loginPhone
      : maskedEmail || signupEmail || loginEmail;

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
            {channel === 'sms'
              ? t('auth.otp.loginCodeSms', 'We sent a 4-digit code to {{phone}}.', {
                  phone: displayDestination,
                })
              : t(
                  'auth.otp.loginCodeEmail',
                  'We sent a 4-digit code to {{email}}.',
                  { email: displayDestination }
                )}
          </Typography>
          {channel === 'sms' && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: 'italic' }}
            >
              {t(
                'auth.otp.smsMayTake',
                'SMS delivery may take 30-60 seconds.'
              )}
            </Typography>
          )}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: 'action.hover',
              px: 2,
              py: 0.75,
              borderRadius: 2,
              alignSelf: 'center',
            }}
          >
            <Typography
              variant="body2"
              color={isExpired ? 'error.main' : 'text.secondary'}
            >
              {isExpired
                ? t('auth.otp.expired', 'Code expired')
                : `${t('auth.otp.expiresIn', 'Expires in')} ${timerLabel}`}
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <Box
            onPaste={handlePaste}
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1.5,
              py: 0.5,
            }}
          >
            {digits.map((d, idx) => (
              <TextField
                key={idx}
                value={d}
                autoFocus={idx === 0}
                disabled={loading || isExpired}
                inputRef={(el) => {
                  inputRefs.current[idx] = el;
                }}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                inputProps={{
                  inputMode: 'numeric',
                  maxLength: 1,
                  'aria-label': t('auth.otp.digitLabel', 'Digit {{n}}', {
                    n: idx + 1,
                  }),
                  style: { textAlign: 'center', fontSize: 22, fontWeight: 700 },
                }}
                sx={{
                  width: 56,
                  '& .MuiOutlinedInput-root': {
                    height: 64,
                    borderRadius: 2,
                  },
                }}
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
                ? t('auth.otp.resendIn', 'Resend in {{seconds}}s', {
                    seconds: resendCooldownSec,
                  })
                : t('auth.otp.resend', 'Resend code')}
          </Button>
          {alternateChannel ? (
            <Button
              color="primary"
              disabled={resendBusy || isExpired}
              onClick={() => void handleResend(alternateChannel)}
            >
              {alternateChannel === 'email'
                ? t(
                    'auth.otp.sendToEmailInstead',
                    'Send code to email instead'
                  )
                : t(
                    'auth.otp.sendToPhoneInstead',
                    'Send code to phone instead'
                  )}
            </Button>
          ) : null}
          <Button
            color="inherit"
            onClick={() => {
              trackAuthGateDismissed(
                isSignup ? 'otp_signup_abandon' : 'otp_login_abandon'
              );
              navigate(isSignup ? '/signup' : '/');
            }}
          >
            {isSignup
              ? t('auth.otp.changeContact', 'Use a different email or phone')
              : t('auth.otp.changeContact', 'Use a different email or phone')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default OtpAuthPage;
