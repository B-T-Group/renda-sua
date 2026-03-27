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
  Divider,
  InputAdornment,
  LinearProgress,
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
import { alpha } from '@mui/material/styles';
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
import LoginMethodDialog from '../auth/LoginMethodDialog';
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
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStep]);

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
        <Stack spacing={{ xs: 2, sm: 2.5 }}>
          <TextField
            fullWidth
            label={t('signupPage.firstName', 'First name')}
            value={form.first_name}
            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
            required
            autoComplete="given-name"
            inputProps={{ autoCapitalize: 'words' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label={t('signupPage.lastName', 'Last name')}
            value={form.last_name}
            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
            required
            autoComplete="family-name"
            inputProps={{ autoCapitalize: 'words' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label={t('signupPage.email', 'Email')}
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
            autoComplete="email"
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
            squareEdges
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
        <Stack spacing={{ xs: 2, sm: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('signupPage.goalSectionTitle', 'Choose what you want to do')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {t(
              'signupPage.goalSectionHint',
              'This helps us set up the right account experience for you.'
            )}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: { xs: 1.25, sm: 1.5 },
            }}
          >
            {goalOptions.map((goal) => {
              const selected = signupGoal === goal.id;
              return (
                <Card
                  key={goal.id}
                  elevation={selected ? 2 : 0}
                  sx={{
                    cursor: 'pointer',
                    border: selected ? 2 : 1,
                    borderColor: selected ? goal.accent : 'divider',
                    borderRadius: 0,
                    transition: 'transform 0.15s ease, box-shadow 0.2s, border-color 0.2s',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    minHeight: { xs: 132, sm: 'auto' },
                    '&:hover': {
                      borderColor: goal.accent,
                      boxShadow: 2,
                    },
                    '&:active': { transform: { xs: 'scale(0.98)', sm: 'none' } },
                  }}
                  onClick={() => handleGoalSelect(goal.id)}
                >
                  <CardContent sx={{ py: { xs: 2, sm: 2 }, px: { xs: 2, sm: 1.5 } }}>
                    <Box sx={{ width: '100%', maxWidth: { xs: 80, sm: 92 }, mb: { xs: 1, sm: 1 }, mx: 'auto' }}>
                      <SignupGoalIllustration goalId={goal.id} accent={goal.accent} />
                    </Box>
                    <Typography variant="subtitle2" fontWeight={700} textAlign="center" gutterBottom sx={{ lineHeight: 1.3 }}>
                      {goal.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ lineHeight: 1.45, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                      {goal.description}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
          {form.user_type_id === 'business' && (
            <TextField
              fullWidth
              label={t('signupPage.businessName', 'Business name')}
              value={form.business_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, business_name: e.target.value }))
              }
              required
              autoComplete="organization"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          )}
        </Stack>
      );
    }

    if (activeStep === 2) {
      return (
        <Stack spacing={{ xs: 2, sm: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('signupPage.addressStepTitle', 'Your address')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {t(
              'signupPage.addressStepHint',
              'Start typing your city—we suggest matches for your region.'
            )}
          </Typography>
          {locationHookError && (
            <Alert severity="warning" sx={{ py: 0.5, borderRadius: 0 }}>
              {locationHookError}
            </Alert>
          )}
          {locationBanner && (
            <Alert severity="info" onClose={() => setLocationBanner(null)} sx={{ py: 0.5, borderRadius: 0 }}>
              {locationBanner}
            </Alert>
          )}
          <Button
            fullWidth={isNarrow}
            variant="outlined"
            size="large"
            sx={{ py: 1.25, borderRadius: 0 }}
            startIcon={
              locationLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <MyLocationIcon />
              )
            }
            onClick={handleUseCurrentLocation}
            disabled={locationLoading}
          >
            {t('signupPage.useCurrentLocation', 'Use current location')}
          </Button>
          <TextField
            fullWidth
            label={t('completeProfile.addressLine1', 'Address Line 1')}
            value={form.address.address_line_1}
            onChange={(e) => handleAddressChange('address_line_1', e.target.value)}
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
            fullWidth
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
            fullWidth
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

    const reviewRow = (label: string, value: string) => (
      <Box sx={{ py: { xs: 1.25, sm: 1 } }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.25 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.45, wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    );

    return (
      <Stack spacing={{ xs: 2, sm: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t('signupPage.reviewTitle', 'Review your details')}
        </Typography>
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 0, overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 2, sm: 2 }, pt: 1.5, pb: 2 }}>
            {reviewRow(
              t('signupPage.review.name', 'Name'),
              `${form.first_name} ${form.last_name}`.trim()
            )}
            <Divider />
            {reviewRow(t('signupPage.review.email', 'Email'), form.email)}
            <Divider />
            {reviewRow(t('signupPage.review.phone', 'Phone'), form.phone_number)}
            <Divider />
            {reviewRow(t('signupPage.review.goal', 'Goal'), goalTitleForReview)}
            {form.user_type_id === 'business' && (
              <>
                <Divider />
                {reviewRow(
                  t('signupPage.review.business', 'Business'),
                  `${form.business_name} (${form.main_interest === 'rent_items'
                    ? t('completeProfile.mainInterest.rentItems', 'Renting out items')
                    : t('completeProfile.mainInterest.sellItems', 'Selling products')})`
                )}
              </>
            )}
            <Divider />
            {reviewRow(t('signupPage.review.address', 'Address'), renderReviewAddress())}
          </Box>
        </Paper>
      </Stack>
    );
  };

  const lastStep = activeStep === steps.length - 1;
  const nextDisabled = !canAdvanceFromStep() || saving;
  const stepProgressPercent = ((activeStep + 1) / steps.length) * 100;

  return (
    <>
    <Container
      maxWidth="sm"
      sx={{
        py: { xs: 2, sm: 5 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Paper
        elevation={isNarrow ? 0 : 1}
        sx={{
          p: { xs: 2, sm: 4 },
          borderRadius: 0,
          border: { xs: `1px solid ${theme.palette.divider}`, sm: 'none' },
          overflow: 'visible',
          '& .MuiOutlinedInput-root': { borderRadius: 0 },
          '& .MuiButton-root': { borderRadius: 0 },
          '& .MuiCard-root': { borderRadius: 0 },
          '& .MuiAlert-root': { borderRadius: 0 },
        }}
      >
        <Stack spacing={{ xs: 2, sm: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 0.5, sm: 0 } }}>
            <Logo variant="default" size={isNarrow ? 'small' : 'medium'} />
          </Box>
          <Typography
            variant={isNarrow ? 'h5' : 'h4'}
            component="h1"
            sx={{ fontWeight: 700, lineHeight: 1.25, textAlign: 'center' }}
          >
            {t('signupPage.title', 'Create your account')}
          </Typography>
          <Typography
            color="text.secondary"
            variant="body2"
            sx={{
              lineHeight: 1.5,
              fontSize: { xs: '0.9375rem', sm: '1rem' },
              textAlign: 'center',
            }}
          >
            {stepSubtitle}
          </Typography>

          {isNarrow ? (
            <Box sx={{ mt: 0.5 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {t('signupPage.stepProgress', 'Step {{current}} of {{total}}', {
                    current: activeStep + 1,
                    total: steps.length,
                  })}
                </Typography>
                <Typography
                  variant="caption"
                  color="primary"
                  fontWeight={700}
                  sx={{ textAlign: 'right', lineHeight: 1.2, maxWidth: '58%' }}
                >
                  {steps[activeStep]}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={stepProgressPercent}
                sx={{
                  height: 8,
                  borderRadius: 0,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  '& .MuiLinearProgress-bar': { borderRadius: 0 },
                }}
              />
            </Box>
          ) : (
            <Stepper
              activeStep={activeStep}
              alternativeLabel
              sx={{ py: 1.5, flexWrap: 'wrap' }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.75rem' } }}>
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          {error && (
            <Alert severity="error" sx={{ borderRadius: 0 }}>
              {error}
            </Alert>
          )}
          {renderStepBody()}

          <Button
            color="inherit"
            onClick={() => setLoginDialogOpen(true)}
            disabled={saving}
            sx={{
              alignSelf: { xs: 'center', sm: 'flex-start' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {t('signupPage.alreadyHaveAccount', 'Already have an account? Log in')}
          </Button>

          <Box
            sx={{
              position: { xs: 'sticky', sm: 'static' },
              bottom: 0,
              zIndex: 8,
              mx: { xs: -2, sm: 0 },
              mt: { xs: 1, sm: 0 },
              pt: { xs: 2, sm: 0 },
              pb: {
                xs: 'max(12px, env(safe-area-inset-bottom, 0px))',
                sm: 0,
              },
              px: { xs: 2, sm: 0 },
              bgcolor: {
                xs: alpha(theme.palette.background.paper, 0.92),
                sm: 'transparent',
              },
              backdropFilter: { xs: 'saturate(180%) blur(12px)', sm: 'none' },
              borderTop: { xs: 1, sm: 0 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="outlined"
                size="large"
                onClick={handleBack}
                disabled={activeStep === 0 || saving}
                sx={{
                  minWidth: { xs: 96, sm: 'auto' },
                  flexShrink: 0,
                  py: 1.25,
                  borderRadius: 0,
                }}
              >
                {t('signupPage.back', 'Back')}
              </Button>
              {!lastStep ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleNext}
                  disabled={nextDisabled}
                  sx={{ py: 1.25, borderRadius: 0, fontWeight: 700 }}
                >
                  {t('signupPage.next', 'Next')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleCreate}
                  disabled={nextDisabled}
                  startIcon={saving ? <CircularProgress size={20} color="inherit" /> : undefined}
                  sx={{ py: 1.25, borderRadius: 0, fontWeight: 700 }}
                >
                  {saving
                    ? t('signupPage.creating', 'Creating...')
                    : t('signupPage.createAccount', 'Create account')}
                </Button>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
    <LoginMethodDialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)} />
    </>
  );
};

export default SignupPage;
