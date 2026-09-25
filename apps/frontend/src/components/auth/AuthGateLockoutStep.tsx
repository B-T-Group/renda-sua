import { Alert, Button, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lockoutMinutesFromMs } from '../../utils/authGateLockoutStorage';

export interface AuthGateLockoutStepProps {
  lockedUntilMs: number;
  onUseDifferentIdentifier: () => void;
}

const AuthGateLockoutStep: React.FC<AuthGateLockoutStepProps> = ({
  lockedUntilMs,
  onUseDifferentIdentifier,
}) => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, lockedUntilMs - nowMs);
  const minutes = lockoutMinutesFromMs(remainingMs);

  return (
    <Stack spacing={2}>
      <Alert severity="warning">
        {t(
          'auth.gate.lockoutMessage',
          'Too many attempts. For your security, please wait {{minutes}} min before trying again.',
          { minutes }
        )}
      </Alert>
      <Typography variant="body2" color="text.secondary">
        {t(
          'auth.gate.lockoutCountdown',
          '{{minutes}} min remaining',
          { minutes }
        )}
      </Typography>
      <Button variant="text" onClick={onUseDifferentIdentifier}>
        {t(
          'auth.gate.useDifferentIdentifier',
          'Use a different email or phone'
        )}
      </Button>
    </Stack>
  );
};

export default AuthGateLockoutStep;
