import CloseRounded from '@mui/icons-material/CloseRounded';
import PhoneAndroidRounded from '@mui/icons-material/PhoneAndroidRounded';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useOptionalUserProfileContext } from '../../contexts/UserProfileContext';
import { nationalDigitsToE164 } from '../../utils/phoneUtils';
import { getBrowserDefaultCountryCode } from '../../utils/authDefaults';

export function AddPhoneBanner() {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const profile = useOptionalUserProfileContext();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const browserCountry = getBrowserDefaultCountryCode();

  const shouldShow = profile?.profile && 
    !profile.profile.email && 
    !profile.profile.phone_number &&
    !dismissed;

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmed = phoneValue.trim();
    if (!trimmed) {
      setError(t('auth.phoneRequired', 'Please enter your phone number'));
      return;
    }
    
    let e164: string;
    try {
      e164 = nationalDigitsToE164(trimmed, browserCountry);
    } catch (err: any) {
      setError(err?.message || t('auth.phoneInvalid', 'Invalid phone number'));
      return;
    }

    setBusy(true);
    try {
      await apiClient.post('/users/me/phone', { phoneNumber: e164 });
      setOpen(false);
      setPhoneValue('');
      setDismissed(true);
      await profile?.refetch();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError(t('auth.phoneAlreadyTaken', 'This phone number is already in use'));
      } else {
        setError(
          err?.response?.data?.error ||
            t('auth.addPhoneFailed', 'Failed to add phone number')
        );
      }
    } finally {
      setBusy(false);
    }
  }, [apiClient, browserCountry, phoneValue, profile, t]);

  if (!shouldShow) return null;

  return (
    <>
      <Box
        sx={{
          bgcolor: 'info.main',
          color: 'info.contrastText',
          py: 1.5,
          px: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ maxWidth: 'xl', mx: 'auto' }}
        >
          <PhoneAndroidRounded fontSize="small" />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {t(
              'auth.addPhoneBanner.message',
              'Add a phone number to secure your account and enable SMS notifications'
            )}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            sx={{
              color: 'inherit',
              borderColor: 'currentColor',
              '&:hover': {
                borderColor: 'currentColor',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
            onClick={() => setOpen(true)}
          >
            {t('auth.addPhoneBanner.cta', 'Add Phone')}
          </Button>
          <IconButton
            size="small"
            sx={{ color: 'inherit' }}
            onClick={() => setDismissed(true)}
            aria-label={t('common.close', 'Close')}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t('auth.addPhoneBanner.dialogTitle', 'Add Phone Number')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'auth.addPhoneBanner.dialogDesc',
                'Adding a phone number helps secure your account and allows you to sign in via SMS.'
              )}
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              fullWidth
              label={t('auth.phoneNumber', 'Phone Number')}
              placeholder={t('auth.phonePlaceholder', 'Phone number')}
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              disabled={busy}
              autoFocus
              inputProps={{ inputMode: 'tel' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={busy || !phoneValue.trim()}
          >
            {busy
              ? t('common.loading', 'Loading…')
              : t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
