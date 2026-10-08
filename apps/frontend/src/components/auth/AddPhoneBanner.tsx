import CloseRounded from '@mui/icons-material/CloseRounded';
import PhoneAndroidRounded from '@mui/icons-material/PhoneAndroidRounded';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useOptionalUserProfileContext } from '../../contexts/UserProfileContext';
import { useMarket } from '../../contexts/MarketContext';
import CountryPhoneNumberInput from '../common/CountryPhoneNumberInput';
import { getDialCodeForActiveCountry, isActivePhoneCountry } from '../../constants/activeCountries';

/**
 * #338 decision 2: signed-in users with no email and no phone (the accounts that can
 * only sign in with a password through Auth0 Universal Login) are asked to add a phone
 * so they can use code sign-in after the soak. Dismiss lasts for the page session.
 */
export function AddPhoneBanner() {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const profile = useOptionalUserProfileContext();
  const { selectedMarket } = useMarket();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState('');
  const [phoneNationalNumber, setPhoneNationalNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDialCode = useMemo(() => {
    const dial = getDialCodeForActiveCountry(phoneCountry);
    return dial ? `+${dial}` : '';
  }, [phoneCountry]);

  const phoneNumberDigits = useMemo(
    () => phoneNationalNumber.replace(/\D/g, ''),
    [phoneNationalNumber]
  );

  const phoneE164 = useMemo(() => {
    if (!phoneDialCode || !phoneNumberDigits) return '';
    return `${phoneDialCode}${phoneNumberDigits}`;
  }, [phoneDialCode, phoneNumberDigits]);

  const isPhoneValid = useMemo(() => {
    if (!phoneE164) return false;
    try {
      return isValidPhoneNumber(phoneE164);
    } catch {
      return false;
    }
  }, [phoneE164]);

  const shouldShow = profile?.profile && 
    !profile.profile.email && 
    !profile.profile.phone_number &&
    !dismissed;

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!isPhoneValid) return;

    setBusy(true);
    try {
      await apiClient.post('/users/me/phone', { phoneNumber: phoneE164 });
      setOpen(false);
      setPhoneNationalNumber('');
      setDismissed(true);
      await profile?.refetch();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError(t('auth.addPhoneBanner.phoneTaken', 'This phone number is already in use'));
      } else if (err?.response?.status === 400) {
        setError(t('auth.addPhoneBanner.phoneInvalid', 'Please enter a valid phone number for the selected country.'));
      } else {
        setError(t('auth.addPhoneFailed', 'Failed to add phone number'));
      }
    } finally {
      setBusy(false);
    }
  }, [apiClient, isPhoneValid, phoneE164, profile, t]);

  useEffect(() => {
    const marketCountry = selectedMarket?.countryCode?.trim().toUpperCase();
    if (marketCountry && isActivePhoneCountry(marketCountry)) {
      setPhoneCountry(marketCountry);
    } else {
      setPhoneCountry('US');
    }
  }, [selectedMarket]);

  if (!shouldShow) return null;

  return (
    <>
      <Alert
        severity="info"
        icon={<PhoneAndroidRounded fontSize="small" />}
        sx={{ borderRadius: 0 }}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => {
                setError(null);
                setOpen(true);
              }}
            >
              {t('auth.addPhoneBanner.cta', 'Add Phone')}
            </Button>
            <IconButton
              size="small"
              onClick={() => setDismissed(true)}
              aria-label={t('common.close', 'Close')}
            >
              <CloseRounded fontSize="small" />
            </IconButton>
          </Stack>
        }
      >
        {t(
          'auth.addPhoneBanner.message',
          'Add a phone number to secure your account and enable SMS notifications'
        )}
      </Alert>

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
            <CountryPhoneNumberInput
              countryCode={phoneCountry}
              onCountryCodeChange={setPhoneCountry}
              nationalNumber={phoneNationalNumber}
              onNationalNumberChange={setPhoneNationalNumber}
              countryLabel={t('auth.phoneCountry', 'Country')}
              phoneLabel={t('auth.phoneNumber', 'Phone Number')}
              invalidPhoneMessage={t(
                'auth.addPhoneBanner.phoneInvalid',
                'Please enter a valid phone number for the selected country.'
              )}
              isPhoneValid={isPhoneValid}
              disabled={busy}
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
            disabled={busy || !isPhoneValid}
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
