import { Alert, Button, Stack, Typography } from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinCodeFields } from '../common/PinCodeFields';
import { getAuthOtpCodeLength } from '../../config/authConfig';
import type { AuthGateFlowState } from '../../hooks/useAuthGateOtp';
import { formatTimerMmSs } from '../../utils/authGateTiming';

export interface AuthGateCodeStepProps {
  flow: AuthGateFlowState;
  busy?: boolean;
  error: string | null;
  onClearError: () => void;
  onBack: () => void;
  onResend: () => void;
  onVerify: (otp: string) => void;
}

const AuthGateCodeStep: React.FC<AuthGateCodeStepProps> = ({
  flow,
  busy,
  error,
  onClearError,
  onBack,
  onResend,
  onVerify,
}) => {
  const { t } = useTranslation();
  const otpLength = getAuthOtpCodeLength();
  const [otp, setOtp] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expiresMs = Math.max(0, flow.codeExpiresAtMs - nowMs);
  const resendMs = Math.max(0, flow.resendAvailableAtMs - nowMs);
  const isExpired = expiresMs <= 0;
  const destination =
    flow.channel === 'sms'
      ? flow.maskedPhone || flow.phone_number
      : flow.maskedEmail || flow.email;

  const otpReady = useMemo(
    () => otp.length === otpLength && new RegExp(`^\\d{${otpLength}}$`).test(otp),
    [otp, otpLength]
  );

  const verifyRef = useRef(onVerify);
  verifyRef.current = onVerify;
  useEffect(() => {
    if (otpReady && !busy && !isExpired) verifyRef.current(otp);
  }, [otpReady, busy, isExpired, otp]);

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={onClearError}>
          {error}
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary">
        {flow.channel === 'sms'
          ? t('auth.gate.codeSentSms', 'We sent a code to {{phone}}.', {
              phone: destination,
            })
          : t('auth.gate.codeSentEmail', 'We sent a code to {{email}}.', {
              email: destination,
            })}
      </Typography>
      <PinCodeFields
        value={otp}
        onChange={setOtp}
        length={otpLength}
        disabled={busy || isExpired}
        autoFocus
        autoCompleteOneTimeCode
      />
      <Typography variant="body2" color={isExpired ? 'error' : 'text.secondary'}>
        {isExpired
          ? t('auth.otp.expired', 'Code expired')
          : t('auth.otp.expiresIn', 'Expires in') + ` ${formatTimerMmSs(expiresMs)}`}
      </Typography>
      <Button
        variant="text"
        disabled={busy || resendMs > 0 || isExpired}
        onClick={onResend}
      >
        {resendMs > 0
          ? t('auth.gate.resendIn', 'Resend in {{time}}', {
              time: formatTimerMmSs(resendMs),
            })
          : t('auth.otp.resend', 'Resend code')}
      </Button>
      <Button variant="text" disabled={busy} onClick={onBack}>
        {t('auth.otp.backToIdentifier', 'Use a different email or phone')}
      </Button>
    </Stack>
  );
};

export default AuthGateCodeStep;
