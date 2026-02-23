import { useAuth0 } from '@auth0/auth0-react';
import {
  ArrowForward,
  Business,
  LocationOn,
  LocalShipping,
  Person,
  Save,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Step,
  StepButton,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { City, State } from 'country-state-city';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { useUserTypes } from '../../hooks/useUserTypes';
import Logo from '../common/Logo';
import PhoneInput from '../common/PhoneInput';

const SIGNUP_COUNTRIES = [
  { code: 'CM', name: 'Cameroon' },
  { code: 'GA', name: 'Gabon' },
];

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  user_type_id: string;
  address: {
    address_line_1: string;
    country: string;
    city: string;
    state: string;
  };
  profile: {
    vehicle_type_id?: string;
    name?: string;
  };
}

const steps = ['Choose Persona', 'Address', 'Personal Information', 'Review & Submit'];

const StepIconWrapper: React.FC<{
  completed?: boolean;
  active?: boolean;
  children: React.ReactNode;
}> = ({ completed, active, children }) => (
  <Box
    sx={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.875rem',
      fontWeight: 600,
      bgcolor: completed ? 'primary.main' : active ? 'primary.main' : 'action.hover',
      color: completed || active ? 'primary.contrastText' : 'text.secondary',
    }}
  >
    {children}
  </Box>
);

const personaOptions = [
  {
    id: 'client',
    title: 'Client',
    description: 'I order items',
    icon: <Person sx={{ fontSize: 40 }} />,
    color: '#1976d2',
  },
  {
    id: 'agent',
    title: 'Agent',
    description: 'I deliver items',
    icon: <LocalShipping sx={{ fontSize: 40 }} />,
    color: '#388e3c',
  },
  {
    id: 'business',
    title: 'Business',
    description: 'I manage items and orders',
    icon: <Business sx={{ fontSize: 40 }} />,
    color: '#f57c00',
  },
];

const CompleteProfile: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { refetch } = useUserProfileContext();
  const { loading: typesLoading, error: typesError } = useUserTypes();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: user?.given_name || '',
    last_name: user?.family_name || '',
    email: user?.email || '',
    phone_number: '',
    user_type_id: '',
    address: {
      address_line_1: '',
      country: '',
      city: '',
      state: '',
    },
    profile: {},
  });

  const addressStates = useMemo(
    () => (profileData.address.country ? State.getStatesOfCountry(profileData.address.country) : []),
    [profileData.address.country]
  );

  const selectedStateCode = useMemo(() => {
    if (!profileData.address.state) return '';
    const found = addressStates.find(
      (s) => s.name === profileData.address.state
    );
    return found?.isoCode ?? '';
  }, [addressStates, profileData.address.state]);

  const addressCities = useMemo(() => {
    if (!profileData.address.country || !selectedStateCode) return [];
    return City.getCitiesOfState(profileData.address.country, selectedStateCode);
  }, [profileData.address.country, selectedStateCode]);

  const handleInputChange =
    (field: keyof ProfileData) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement>
        | { target: { value: unknown } }
    ) => {
      setProfileData({
        ...profileData,
        [field]: event.target.value,
      });
    };

  const handleProfileChange =
    (field: keyof ProfileData['profile']) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement>
        | { target: { value: unknown } }
    ) => {
      setProfileData({
        ...profileData,
        profile: {
          ...profileData.profile,
          [field]: event.target.value,
        },
      });
    };

  const handlePersonaSelect = (userTypeId: string) => {
    setProfileData({
      ...profileData,
      user_type_id: userTypeId,
      profile: {},
    });
  };

  const handleAddressChange = (field: keyof ProfileData['address'], value: string) => {
    setProfileData({
      ...profileData,
      address: {
        ...profileData.address,
        [field]: value,
        ...(field === 'country' && { state: '', city: '' }),
        ...(field === 'state' && { city: '' }),
      },
    });
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSubmit = async () => {
    if (!apiClient) {
      setError('API client not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.post('/users', profileData);
      setSuccess(true);

      // Refresh the Auth0 token to ensure we have the latest token
      try {
        await getAccessTokenSilently({
          cacheMode: 'off',
        });
      } catch (tokenError) {
        console.warn('Failed to refresh Auth0 token:', tokenError);
        // Continue with profile refresh even if token refresh fails
      }

      // Refresh the user profile context
      await refetch();

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/app');
      }, 2000);
    } catch (err: unknown) {
      let errorMessage = 'Failed to create user. Please try again.';

      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: { error?: string } } })
          .response;
        if (response?.data?.error) {
          errorMessage = response.data.error;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return profileData.user_type_id !== '';
      case 1: {
        const a = profileData.address;
        return !!(
          a.address_line_1?.trim() &&
          a.country &&
          a.city?.trim() &&
          a.state
        );
      }
      case 2: {
        const hasRequiredFields =
          profileData.first_name &&
          profileData.last_name &&
          profileData.user_type_id;

        if (profileData.user_type_id === 'business') {
          return hasRequiredFields && profileData.profile.name;
        }

        return hasRequiredFields;
      }
      default:
        return true;
    }
  };

  const getSelectedPersona = () => {
    return personaOptions.find((p) => p.id === profileData.user_type_id);
  };

  const handleStepClick = (step: number) => {
    if (step < activeStep || (step === activeStep + 1 && isStepValid(activeStep))) {
      setActiveStep(step);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Typography variant="h6" gutterBottom>
              {t('completeProfile.choosePersona', 'Choose Your Persona')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('completeProfile.choosePersonaHint', 'Select the type of account you want to create')}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 1.5, sm: 2 },
              }}
            >
              {personaOptions.map((persona) => (
                <Box key={persona.id} sx={{ flex: 1 }}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: profileData.user_type_id === persona.id ? 2 : 1,
                      borderColor:
                        profileData.user_type_id === persona.id
                          ? persona.color
                          : 'divider',
                      '&:hover': {
                        borderColor: persona.color,
                        boxShadow: 2,
                      },
                    }}
                    onClick={() => handlePersonaSelect(persona.id)}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <Box sx={{ color: persona.color, mb: 2 }}>
                        {persona.icon}
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {persona.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {persona.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LocationOn color="primary" />
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                {t('completeProfile.addressStep', 'Address')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('completeProfile.addressStepHint', 'We use your address to tailor content and delivery options for you.')}
            </Typography>

            <TextField
              label={t('completeProfile.addressLine1', 'Address Line 1')}
              value={profileData.address.address_line_1}
              onChange={(e) => handleAddressChange('address_line_1', e.target.value)}
              fullWidth
              required
            />

            <FormControl fullWidth required>
              <InputLabel>{t('completeProfile.country', 'Country')}</InputLabel>
              <Select
                value={profileData.address.country}
                label={t('completeProfile.country', 'Country')}
                onChange={(e) => handleAddressChange('country', e.target.value)}
              >
                {SIGNUP_COUNTRIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required disabled={!profileData.address.country}>
              <InputLabel>{t('completeProfile.state', 'State / Region')}</InputLabel>
              <Select
                value={profileData.address.state}
                label={t('completeProfile.state', 'State / Region')}
                onChange={(e) => handleAddressChange('state', e.target.value)}
              >
                {addressStates.map((s) => (
                  <MenuItem key={s.isoCode} value={s.name}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Autocomplete
              freeSolo
              options={addressCities.map((c) => c.name)}
              value={profileData.address.city}
              onInputChange={(_, value) => handleAddressChange('city', value ?? '')}
              onChange={(_, value) => handleAddressChange('city', typeof value === 'string' ? value : value ?? '')}
              disabled={!profileData.address.country || !profileData.address.state}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('completeProfile.city', 'City')}
                  required
                />
              )}
            />
          </Box>
        );

      case 2:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Typography variant="h6" gutterBottom>
              {t('completeProfile.personalInformation', 'Personal Information')}
            </Typography>

            <TextField
              label="First Name"
              value={profileData.first_name}
              onChange={handleInputChange('first_name')}
              fullWidth
              required
            />

            <TextField
              label="Last Name"
              value={profileData.last_name}
              onChange={handleInputChange('last_name')}
              fullWidth
              required
            />

            <PhoneInput
              value={profileData.phone_number}
              onChange={(value) =>
                setProfileData({
                  ...profileData,
                  phone_number: value || '',
                })
              }
              label="Phone Number"
              helperText="This phone number should be your mobile money phone number and will be used for payments associated with your account."
              required
              useDevPhoneDropdown
            />

            {profileData.user_type_id === 'business' && (
              <TextField
                label="Business Name"
                value={profileData.profile.name || ''}
                onChange={handleProfileChange('name')}
                fullWidth
                required
              />
            )}
          </Box>
        );

      case 3: {
        const selectedPersona = getSelectedPersona();
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Typography variant="h6" gutterBottom>
              {t('completeProfile.reviewTitle', 'Review Your Information')}
            </Typography>

            <Paper sx={{ p: { xs: 1.25, sm: 2 }, bgcolor: 'grey.50' }}>
              <Typography variant="body2" gutterBottom>
                <strong>Name:</strong> {profileData.first_name}{' '}
                {profileData.last_name}
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{
                  wordBreak: 'break-all',
                  overflowWrap: 'anywhere',
                }}
              >
                <strong>Email:</strong>{' '}
                {profileData.email || 'Not provided'}
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                <strong>Phone Number:</strong>{' '}
                {profileData.phone_number || 'Not provided'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Persona:</strong> {selectedPersona?.title}
              </Typography>
              {profileData.user_type_id === 'business' &&
                profileData.profile.name && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Business Name:</strong> {profileData.profile.name}
                  </Typography>
                )}
              <Typography variant="body2" gutterBottom>
                <strong>Address:</strong>{' '}
                {profileData.address.address_line_1},{' '}
                {profileData.address.city}, {profileData.address.state},{' '}
                {SIGNUP_COUNTRIES.find((c) => c.code === profileData.address.country)?.name ||
                  profileData.address.country}
              </Typography>
            </Paper>
          </Box>
        );
      }

      default:
        return null;
    }
  };

  if (typesError) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: { xs: 1, sm: 2 },
        }}
      >
        <Paper
          sx={{
            p: { xs: 3, sm: 6 },
            textAlign: 'center',
            maxWidth: 500,
            width: '90%',
          }}
        >
          <Alert severity="error" sx={{ mb: 3 }}>
            {typesError}
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Paper>
      </Box>
    );
  }

  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: { xs: 1, sm: 2 },
        }}
      >
        <Paper
          sx={{
            p: { xs: 3, sm: 6 },
            textAlign: 'center',
            maxWidth: 500,
            width: '90%',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Logo variant="default" size="large" />
          </Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Profile Complete!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Your profile has been successfully created. Redirecting to
            dashboard...
          </Typography>
          <CircularProgress size={24} />
        </Paper>
      </Box>
    );
  }

  const stepContent = (
    <>
      <Box sx={{ textAlign: 'center', mb: { xs: 1.5, sm: 4 } }}>
        <Box sx={{ mb: { xs: 1, sm: 2 } }}>
          <Logo variant="default" size="large" />
        </Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
          {t('completeProfile.title', 'Complete Your Profile')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('completeProfile.subtitle', 'Please provide some additional information to complete your account setup')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: { xs: 2, sm: 3 } }}>
          {error}
        </Alert>
      )}

      {typesLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 2, sm: 3 } }}>
          <CircularProgress />
        </Box>
      )}

      <Stepper
        activeStep={activeStep}
        sx={{ mb: { xs: 1.5, sm: 4 }, overflow: 'auto', py: 1.5, px: { xs: 0, sm: 2 } }}
      >
        {steps.map((_, index) => (
          <Step key={index}>
            <StepButton
              onClick={() => handleStepClick(index)}
              icon={
                <StepIconWrapper
                  completed={index < activeStep}
                  active={index === activeStep}
                >
                  {index + 1}
                </StepIconWrapper>
              }
              sx={{ cursor: index <= activeStep ? 'pointer' : 'default' }}
            />
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mb: { xs: 1.5, sm: 4 } }}>{renderStepContent(activeStep)}</Box>
    </>
  );

  const navButtons = (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Button disabled={activeStep === 0} onClick={handleBack}>
        Back
      </Button>
      <Box>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !isStepValid(activeStep) || typesLoading}
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
          >
            {loading ? t('completeProfile.creating', 'Creating...') : t('completeProfile.completeButton', 'Complete Profile')}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!isStepValid(activeStep) || typesLoading}
            endIcon={<ArrowForward />}
          >
            Next
          </Button>
        )}
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Dialog
        fullScreen
        open
        PaperProps={{ sx: { m: 0, maxHeight: '100dvh', borderRadius: 0 } }}
      >
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100dvh',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ flexShrink: 0, px: 2, pt: 2, pb: 1 }}>
            <Button onClick={activeStep === 0 ? () => navigate(-1) : handleBack} size="small">
              Back
            </Button>
          </Box>
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              minHeight: 0,
              px: 2,
              pb: 2,
            }}
          >
            <Box sx={{ maxWidth: 600, mx: 'auto', width: '100%' }}>{stepContent}</Box>
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
              p: 2,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0))',
            }}
          >
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                variant="outlined"
                fullWidth
              >
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading || !isStepValid(activeStep) || typesLoading}
                  startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                  fullWidth
                >
                  {loading ? t('completeProfile.creating', 'Creating...') : t('completeProfile.completeButton', 'Complete Profile')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!isStepValid(activeStep) || typesLoading}
                  endIcon={<ArrowForward />}
                  fullWidth
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: { xs: 1, sm: 2 },
      }}
    >
      <Paper sx={{ p: { xs: 1.5, sm: 4 }, maxWidth: 800, width: '100%' }}>
        {stepContent}
        {navButtons}
      </Paper>
    </Box>
  );
};

export default CompleteProfile;
