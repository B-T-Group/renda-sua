import { Public as PublicIcon } from '@mui/icons-material';
import {
  Alert,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSignupWizardUi } from '../wizard/SignupWizardUiContext';
import type { SignupFormValues } from '../wizard/types';

export const CountryStep: React.FC = () => {
  const { t } = useTranslation();
  const { countries, countriesLoading } = useSignupWizardUi();
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<SignupFormValues>();
  const country = useWatch({ control, name: 'country' });
  const prevCountry = useRef(country);
  const [countryChangedNotice, setCountryChangedNotice] = useState(false);

  const signupCountries = countries.filter((c) => c.signupEnabled);

  useEffect(() => {
    if (prevCountry.current && country && prevCountry.current !== country) {
      setValue('contact.phone', '');
      setValue('storeLocation.street', '');
      setValue('storeLocation.city', '');
      setValue('storeLocation.region', '');
      setValue('storeLocation.postalCode', '');
      setValue('storeLocation.latitude', undefined);
      setValue('storeLocation.longitude', undefined);
      setCountryChangedNotice(true);
    }
    prevCountry.current = country;
  }, [country, setValue]);

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t('signupPage.countryStepTitle', 'Your country')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
        {t(
          'signupPage.countryStepHint',
          'Your country determines payments, verification, and local options.'
        )}
      </Typography>
      {countryChangedNotice && (
        <Alert
          severity="info"
          onClose={() => setCountryChangedNotice(false)}
          sx={{ borderRadius: 0 }}
        >
          {t(
            'signupPage.countryChangedReset',
            'Phone and store location fields were reset for the new country.'
          )}
        </Alert>
      )}
      {countriesLoading ? (
        <CircularProgress size={28} />
      ) : (
        <Controller
          name="country"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              fullWidth
              required
              label={t('completeProfile.country', 'Country')}
              error={Boolean(errors.country)}
              helperText={errors.country?.message || ' '}
              SelectProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PublicIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            >
              {signupCountries.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.name ||
                    t(`completeProfile.countries.${c.code}`, c.code)}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      )}
    </Stack>
  );
};
