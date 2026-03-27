import { useAuth0 } from '@auth0/auth0-react';
import {
  Business as BusinessIcon,
  EmailOutlined as EmailOutlinedIcon,
  HomeOutlined as HomeOutlinedIcon,
  LocationCity as LocationCityIcon,
  Map as MapIcon,
  MyLocation as MyLocationIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  PhoneOutlined as PhoneOutlinedIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { City, State } from 'country-state-city';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import {
  findCountryCodeFromGeocodeName,
  findMatchedCityName,
  findMatchedStateNameForCountry,
} from '../../utils/locationAddressMatch';
import Logo from '../common/Logo';
import PhoneInput from '../common/PhoneInput';
import { SignupGoalIllustration, type SignupGoalId } from '../onboarding/SignupGoalIllustration';

const SIGNUP_COUNTRY_CODES = ['CM', 'GA', 'US', 'CA'] as const;

type SignupIntent = 'client_buy' | 'business_sell' | 'business_rent';
type UserType = 'client' | 'business' | 'agent';
type MainInterest = 'sell_items' | 'rent_items';

interface SignupGoalOption {
  id: SignupGoalId;
  title: string;
  description: string;
  accent: string;
  userType: UserType;
  mainInterest?: MainInterest;
}

interface SignupStartUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type_id: string;
  phone_number: string | null;
  email_verified: boolean;
}

interface SignupAddress {
  address_line_1: string;
  country: string;
  city: string;
  state: string;
}

const intentDefaults = (intent: SignupIntent | null) => {
  if (intent === 'business_sell')
    return { user_type_id: 'business' as UserType, main_interest: 'sell_items' as const };
  if (intent === 'business_rent')
    return { user_type_id: 'business' as UserType, main_interest: 'rent_items' as const };
  return { user_type_id: 'client' as UserType, main_interest: undefined };
};

const SignupPage: React.FC = () => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithRedirect, } = useAuth0();
  const apiClient = useApiClient();
  const defaults = useMemo(
    () => intentDefaults((search.get('intent') as SignupIntent | null) || null),
    [search]
  );
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    user_type_id: defaults.user_type_id,
    business_name: '',
    main_interest: defaults.main_interest || 'sell_items',
    address: {
      address_line_1: '',
      country: '',
      city: '',
      state: '',
    } as SignupAddress,
  });
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationBanner, setLocationBanner] = useState<string | null>(null);
  const {
    getCurrentLocation,
    loading: locationLoading,
    error: locationHookError,
  } = useCurrentLocation();
  const [signupGoal, setSignupGoal] = useState<SignupGoalId>(
    defaults.user_type_id === 'business'
      ? defaults.main_interest === 'rent_items'
        ? 'rent_and_earn'
        : 'sell_items'
      : 'browse_buy'
  );

  const steps = useMemo(
    () => [
      t('signupPage.steps.contact', 'Contact'),
      t('signupPage.steps.goal', 'Your goal'),
      t('signupPage.steps.address', 'Address'),
      t('signupPage.steps.review', 'Review'),
    ],
    [t]
  );

  const stepSubtitle = useMemo(() => {
    switch (activeStep) {
      case 0:
        return t(
          'signupPage.contactSubtitle',
          'Enter your name and how we can reach you.'
        );
      case 1:
        return t(
          'signupPage.goalSubtitle',
          'Choose what fits you—we will configure the right account type.'
        );
      case 2:
        return t(
          'signupPage.addressSubtitle',
          'We use this to tailor delivery and local options.'
        );
      default:
        return t(
          'signupPage.reviewSubtitle',
          'Check everything looks correct, then create your account.'
        );
    }
  }, [activeStep, t]);

  const goalOptions: SignupGoalOption[] = useMemo(
    () => [
      {
        id: 'browse_buy',
        title: t('signupPage.goals.browse_buy.title', 'I want to buy stuff'),
        description: t(
          'signupPage.goals.browse_buy.description',
          'Shop products and get fast delivery to your location.'
        ),
        accent: theme.palette.primary.main,
        userType: 'client',
      },
      {
        id: 'rent_and_earn',
        title: t('signupPage.goals.rent_and_earn.title', 'I want to rent stuff'),
        description: t(
          'signupPage.goals.rent_and_earn.description',
          'List items for rent and earn from bookings.'
        ),
        accent: '#00897b',
        userType: 'business',
        mainInterest: 'rent_items',
      },
      {
        id: 'sell_items',
        title: t('signupPage.goals.sell_items.title', 'I want to sell stuff'),
        description: t(
          'signupPage.goals.sell_items.description',
          'Open your business store and manage sales.'
        ),
        accent: '#f57c00',
        userType: 'business',
        mainInterest: 'sell_items',
      },
      {
        id: 'delivery_agent',
        title: t(
          'signupPage.goals.delivery_agent.title',
          'I want to make money via deliveries'
        ),
        description: t(
          'signupPage.goals.delivery_agent.description',
          'Deliver customer orders and get paid for each trip.'
        ),
        accent: '#388e3c',
        userType: 'agent',
      },
    ],
    [t, theme.palette.primary.main]
  );

  useEffect(() => {
    const initialGoal =
      defaults.user_type_id === 'business'
        ? defaults.main_interest === 'rent_items'
          ? 'rent_and_earn'
          : 'sell_items'
        : 'browse_buy';
    setSignupGoal(initialGoal);
    setForm((prev) => ({
      ...prev,
      user_type_id: defaults.user_type_id,
      main_interest: defaults.main_interest || prev.main_interest,
    }));
  }, [defaults]);

  const addressStates = useMemo(
    () => (form.address.country ? State.getStatesOfCountry(form.address.country) : []),
    [form.address.country]
  );

  const selectedStateCode = useMemo(() => {
    if (!form.address.state) return '';
    const found = addressStates.find((s) => s.name === form.address.state);
    return found?.isoCode ?? '';
  }, [addressStates, form.address.state]);

  const addressCities = useMemo(() => {
    if (!form.address.country || !selectedStateCode) return [];
    return City.getCitiesOfState(form.address.country, selectedStateCode);
  }, [form.address.country, selectedStateCode]);

  const handleGoalSelect = (goalId: SignupGoalId) => {
    const selected = goalOptions.find((option) => option.id === goalId);
    if (!selected) return;
    setSignupGoal(goalId);
    setForm((prev) => ({
      ...prev,
      user_type_id: selected.userType,
      main_interest:
        selected.userType === 'business'
          ? selected.mainInterest ?? 'sell_items'
          : prev.main_interest,
    }));
  };

  const handleAddressChange = (field: keyof SignupAddress, value: string) => {
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
        ...(field === 'country' && { state: '', city: '' }),
        ...(field === 'state' && { city: '' }),
      },
    }));
  };

  const handleUseCurrentLocation = useCallback(async () => {
    setLocationBanner(null);
    try {
      const loc = await getCurrentLocation();
      if (loc.address) {
        const countryCode = findCountryCodeFromGeocodeName(loc.country || '');
        const allowedCountry =
          countryCode && SIGNUP_COUNTRY_CODES.includes(countryCode as (typeof SIGNUP_COUNTRY_CODES)[number])
            ? countryCode
            : '';
        const stateName = allowedCountry
          ? findMatchedStateNameForCountry(loc.state, allowedCountry)
          : '';
        const stateIso = allowedCountry
          ? State.getStatesOfCountry(allowedCountry).find((s) => s.name === stateName)
              ?.isoCode || ''
          : '';
        const cityName =
          allowedCountry && stateIso
            ? findMatchedCityName(loc.city, allowedCountry, stateIso)
            : (loc.city || '').trim();

        setForm((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            address_line_1: loc.address || prev.address.address_line_1,
            country: allowedCountry || prev.address.country,
            state: stateName || prev.address.state,
            city: cityName || prev.address.city,
          },
        }));
      } else {
        setLocationBanner(
          t(
            'signupPage.locationUnavailable',
            'Could not resolve address from your location.'
          )
        );
      }
    } catch (e: any) {
      setLocationBanner(
        e?.message ||
          t(
            'signupPage.locationFailed',
            'Unable to get your location. Check permissions and try again.'
          )
      );
    }
  }, [getCurrentLocation, t]);

  useEffect(() => {
    if (!form.email || form.email.length < 5) {
      setEmailTaken(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setCheckingEmail(true);
        const { data } = await apiClient.get<{ taken: boolean }>('/auth/email-availability', {
          params: { email: form.email },
        });
        setEmailTaken(Boolean(data?.taken));
      } catch {
        setEmailTaken(false);
      } finally {
        setCheckingEmail(false);
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [apiClient, form.email]);

  const canAdvanceFromStep = useCallback((): boolean => {
    switch (activeStep) {
      case 0:
        return Boolean(
          form.first_name.trim() &&
            form.last_name.trim() &&
            form.email.trim() &&
            form.phone_number.trim() &&
            !emailTaken &&
            !checkingEmail
        );
      case 1:
        if (form.user_type_id === 'business') {
          return Boolean(form.business_name.trim() && form.main_interest);
        }
        return Boolean(signupGoal);
      case 2:
        return Boolean(
          form.address.address_line_1.trim() &&
            form.address.country &&
            form.address.state &&
            form.address.city.trim()
        );
      default:
        return true;
    }
  }, [activeStep, form, emailTaken, checkingEmail, signupGoal]);

  const redirectToAuthAfterSignup = useCallback(
    async (emailNormalized: string) => {
      try {
        await loginWithRedirect({
          authorizationParams: {
            login_hint: emailNormalized,
            connection: 'email',
            screen_hint: 'signup',
          },
          appState: { returnTo: '/app' },
        });
      } catch (redirectErr: any) {
        console.error('loginWithRedirect failed:', redirectErr);
        navigate('/auth/otp?flow=signup');
      }
    },
    [loginWithRedirect, navigate]
  );

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone_number: form.phone_number,
        user_type_id: form.user_type_id,
        profile: {
          name: form.user_type_id === 'business' ? form.business_name : undefined,
          main_interest: form.user_type_id === 'business' ? form.main_interest : undefined,
        },
        address: {
          address_line_1: form.address.address_line_1.trim(),
          country: form.address.country,
          city: form.address.city.trim(),
          state: form.address.state,
        },
      };
      const { data } = await apiClient.post<{ success: boolean; user: SignupStartUser }>(
        '/auth/signup/start',
        payload
      );
      const emailNormalized = data.user.email.trim().toLowerCase();
      sessionStorage.setItem('pendingSignupUserId', data.user.id);
      sessionStorage.setItem('pendingSignupEmail', emailNormalized);
      await redirectToAuthAfterSignup(emailNormalized);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          t('signupPage.createAccountError', 'Unable to create account at this time.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (!canAdvanceFromStep()) return;
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((s) => Math.max(0, s - 1));
  };

  const goalTitleForReview = useMemo(() => {
    const g = goalOptions.find((o) => o.id === signupGoal);
    return g?.title ?? '';
  }, [goalOptions, signupGoal]);

  const renderReviewAddress = () => {
    const c = form.address.country;
    const countryLabel = c
      ? t(`completeProfile.countries.${c}`, c)
      : '';
    return `${form.address.address_line_1}, ${form.address.city}, ${form.address.state}, ${countryLabel}`;
  };

  const renderStepBody = () => {
    if (activeStep === 0) {
      return (
        <Stack spacing={2.5}>
          <TextField
            label={t('signupPage.firstName', 'First name')}
            value={form.first_name}
            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label={t('signupPage.lastName', 'Last name')}
            value={form.last_name}
            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label={t('signupPage.email', 'Email')}
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
            error={emailTaken}
            helperText={
              emailTaken
                ? t('signupPage.emailTaken', 'This email is already taken.')
                : checkingEmail
                  ? t('signupPage.checkingEmail', 'Checking email availability...')
                  : ' '
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <PhoneInput
            value={form.phone_number}
            onChange={(value) =>
              setForm((p) => ({
                ...p,
                phone_number: value || '',
              }))
            }
            label={t('signupPage.phoneNumber', 'Phone number')}
            helperText={t(
              'signupPage.phoneHelper',
              'Use the mobile number linked to your payment account.'
            )}
            required
            useDevPhoneDropdown
            startAdornment={
              <InputAdornment position="start">
                <PhoneOutlinedIcon fontSize="small" color="action" />
              </InputAdornment>
            }
          />
        </Stack>
      );
    }

    if (activeStep === 1) {
      return (
        <Stack spacing={2.5}>
          <Typography variant="subtitle1" sx={{ mb: 0 }}>
            {t('signupPage.goalSectionTitle', 'Choose what you want to do')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'signupPage.goalSectionHint',
              'This helps us set up the right account experience for you.'
            )}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 1.5,
            }}
          >
            {goalOptions.map((goal) => {
              const selected = signupGoal === goal.id;
              return (
                <Card
                  key={goal.id}
                  sx={{
                    cursor: 'pointer',
                    border: selected ? 2 : 1,
                    borderColor: selected ? goal.accent : 'divider',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                    '&:hover': {
                      borderColor: goal.accent,
                      boxShadow: 3,
                    },
                  }}
                  onClick={() => handleGoalSelect(goal.id)}
                >
                  <CardContent sx={{ py: 2, px: 1.5 }}>
                    <Box sx={{ width: '100%', maxWidth: 92, mb: 1, mx: 'auto' }}>
                      <SignupGoalIllustration goalId={goal.id} accent={goal.accent} />
                    </Box>
                    <Typography variant="subtitle2" fontWeight={700} textAlign="center" gutterBottom>
                      {goal.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      {goal.description}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
          {form.user_type_id === 'business' && (
            <>
              <TextField
                label={t('signupPage.businessName', 'Business name')}
                value={form.business_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, business_name: e.target.value }))
                }
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </>
          )}
        </Stack>
      );
    }

    if (activeStep === 2) {
      return (
        <Stack spacing={2.5}>
          <Typography variant="subtitle1">
            {t('signupPage.addressStepTitle', 'Your address')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'signupPage.addressStepHint',
              'Start typing your city—we suggest matches for your region.'
            )}
          </Typography>
          {locationHookError && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              {locationHookError}
            </Alert>
          )}
          {locationBanner && (
            <Alert severity="info" onClose={() => setLocationBanner(null)} sx={{ py: 0.5 }}>
              {locationBanner}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="medium"
              startIcon={
                locationLoading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <MyLocationIcon />
                )
              }
              onClick={handleUseCurrentLocation}
              disabled={locationLoading}
            >
              {t('signupPage.useCurrentLocation', 'Use current location')}
            </Button>
          </Box>
          <TextField
            label={t('completeProfile.addressLine1', 'Address Line 1')}
            value={form.address.address_line_1}
            onChange={(e) => handleAddressChange('address_line_1', e.target.value)}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <HomeOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            fullWidth
            required
            label={t('completeProfile.country', 'Country')}
            value={form.address.country}
            onChange={(e) => handleAddressChange('country', e.target.value)}
            SelectProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PublicIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          >
            {SIGNUP_COUNTRY_CODES.map((code) => (
              <MenuItem key={code} value={code}>
                {t(`completeProfile.countries.${code}`, code)}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            options={addressStates.map((s) => s.name)}
            value={form.address.state || null}
            onChange={(_, value) => handleAddressChange('state', value ?? '')}
            disabled={!form.address.country}
            isOptionEqualToValue={(a, b) => a === b}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('completeProfile.state', 'State / Region')}
                required
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <MapIcon fontSize="small" color="action" />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <Autocomplete
            freeSolo
            options={addressCities.map((c) => c.name)}
            value={form.address.city}
            onInputChange={(_, value) => handleAddressChange('city', value ?? '')}
            onChange={(_, value) =>
              handleAddressChange('city', typeof value === 'string' ? value : value ?? '')
            }
            disabled={!form.address.country || !form.address.state}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('completeProfile.city', 'City')}
                required
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <LocationCityIcon fontSize="small" color="action" />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Stack>
      );
    }

    return (
      <Stack spacing={2}>
        <Typography variant="subtitle1">
          {t('signupPage.reviewTitle', 'Review your details')}
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>{t('signupPage.review.name', 'Name')}:</strong>{' '}
              {form.first_name} {form.last_name}
            </Typography>
            <Typography variant="body2">
              <strong>{t('signupPage.review.email', 'Email')}:</strong> {form.email}
            </Typography>
            <Typography variant="body2">
              <strong>{t('signupPage.review.phone', 'Phone')}:</strong> {form.phone_number}
            </Typography>
            <Typography variant="body2">
              <strong>{t('signupPage.review.goal', 'Goal')}:</strong> {goalTitleForReview}
            </Typography>
            {form.user_type_id === 'business' && (
              <Typography variant="body2">
                <strong>{t('signupPage.review.business', 'Business')}:</strong>{' '}
                {form.business_name} (
                {form.main_interest === 'rent_items'
                  ? t('completeProfile.mainInterest.rentItems', 'Renting out items')
                  : t('completeProfile.mainInterest.sellItems', 'Selling products')}
                )
              </Typography>
            )}
            <Typography variant="body2">
              <strong>{t('signupPage.review.address', 'Address')}:</strong> {renderReviewAddress()}
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    );
  };

  const lastStep = activeStep === steps.length - 1;
  const nextDisabled = !canAdvanceFromStep() || saving;

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Logo variant="default" size="medium" />
          </Box>
          <Typography variant="h4">
            {t('signupPage.title', 'Create your account')}
          </Typography>
          <Typography color="text.secondary">{stepSubtitle}</Typography>
          <Stepper
            activeStep={activeStep}
            alternativeLabel={!isNarrow}
            sx={{ py: 1, flexWrap: 'wrap' }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.75rem' } }}>
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
          {error && <Alert severity="error">{error}</Alert>}
          {renderStepBody()}
          <Stack direction="row" spacing={2} justifyContent="space-between" flexWrap="wrap">
            <Button onClick={handleBack} disabled={activeStep === 0 || saving}>
              {t('signupPage.back', 'Back')}
            </Button>
            {!lastStep ? (
              <Button variant="contained" onClick={handleNext} disabled={nextDisabled}>
                {t('signupPage.next', 'Next')}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={nextDisabled}
                startIcon={saving ? <CircularProgress size={18} /> : undefined}
              >
                {saving
                  ? t('signupPage.creating', 'Creating...')
                  : t('signupPage.createAccount', 'Create account')}
              </Button>
            )}
          </Stack>
          <Box>
            <Button onClick={() => navigate('/')} disabled={saving}>
              {t('signupPage.alreadyHaveAccount', 'Already have an account? Log in')}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default SignupPage;
