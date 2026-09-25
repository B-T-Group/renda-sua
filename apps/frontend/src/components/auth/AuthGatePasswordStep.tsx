import LockOutlined from '@mui/icons-material/LockOutlined';
import {
  Alert,
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface AuthGatePasswordStepProps {
  busy?: boolean;
  error: string | null;
  initialEmail?: string;
  onClearError: () => void;
  onSignInWithCode: () => void;
  onSubmit: (payload: { email: string; password: string }) => void;
}

const AuthGatePasswordStep: React.FC<AuthGatePasswordStepProps> = ({
  busy,
  error,
  initialEmail = '',
  onClearError,
  onSignInWithCode,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');

  const submit = useCallback(() => {
    onClearError();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      return;
    }
    if (!password) return;
    onSubmit({ email: trimmed, password });
  }, [email, onClearError, onSubmit, password]);

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={onClearError}>
          {error}
        </Alert>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2.5,
          p: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          >
            <LockOutlined fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('auth.passwordLoginTitle', 'Continue with password')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'auth.loginMethodHintPassword',
                'Sign in with the email and password for your account.'
              )}
            </Typography>
          </Box>
        </Stack>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            type="email"
            placeholder={t('auth.emailPlaceholder', 'you@example.com')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            autoFocus
            inputProps={{ inputMode: 'email' }}
          />
          <TextField
            fullWidth
            type="password"
            placeholder={t('auth.gate.passwordPlaceholder', 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </Stack>
      </Box>
      <Button variant="contained" size="large" disabled={busy} onClick={submit}>
        {t('auth.signIn', 'Sign In')}
      </Button>
      <Link
        component="button"
        type="button"
        variant="body2"
        onClick={onSignInWithCode}
        sx={{ alignSelf: 'center', fontWeight: 600 }}
      >
        {t('auth.gate.signInWithCodeInstead', 'Sign in with a code instead')}
      </Link>
    </Stack>
  );
};

export default AuthGatePasswordStep;
