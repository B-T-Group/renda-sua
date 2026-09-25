import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

export interface AuthGateFinishStepProps {
  busy: boolean;
  error: string | null;
  onClearError: () => void;
  onSubmit: (payload: {
    first_name: string;
    last_name: string;
    accept_terms: boolean;
  }) => void | Promise<void>;
}

const AuthGateFinishStep: React.FC<AuthGateFinishStepProps> = ({
  busy,
  error,
  onClearError,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const firstTrim = useMemo(() => firstName.trim(), [firstName]);
  const lastTrim = useMemo(() => lastName.trim(), [lastName]);
  const canSubmit = Boolean(firstTrim && lastTrim && acceptTerms && !busy);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={700}>
        {t('auth.gate.finish.title', 'Finish your account')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'auth.gate.finish.body',
          'Add your name and accept the terms to continue.'
        )}
      </Typography>
      {error ? (
        <Alert severity="error" onClose={onClearError}>
          {error}
        </Alert>
      ) : null}
      <TextField
        label={t('auth.gate.finish.firstName', 'First name')}
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        autoComplete="given-name"
        disabled={busy}
        fullWidth
        size="small"
      />
      <TextField
        label={t('auth.gate.finish.lastName', 'Last name')}
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        autoComplete="family-name"
        disabled={busy}
        fullWidth
        size="small"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            disabled={busy}
          />
        }
        label={
          <Typography variant="body2">
            {t('auth.gate.finish.acceptTermsPrefix', 'I accept the')}{' '}
            <Link component={RouterLink} to="/terms" target="_blank">
              {t('auth.gate.finish.termsLink', 'Terms of Service')}
            </Link>
          </Typography>
        }
      />
      <Button
        variant="contained"
        fullWidth
        disabled={!canSubmit}
        onClick={() =>
          void onSubmit({
            first_name: firstTrim,
            last_name: lastTrim,
            accept_terms: true,
          })
        }
      >
        {t('auth.gate.finish.continue', 'Continue')}
      </Button>
    </Stack>
  );
};

export default AuthGateFinishStep;
