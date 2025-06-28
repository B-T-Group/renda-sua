import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import {
  Save,
  ArrowForward,
  Person,
  LocalShipping,
  Business,
} from '@mui/icons-material';
import { useAuth0 } from '@auth0/auth0-react';
import { useApiClient } from '../../hooks/useApiClient';
import { useUserTypes } from '../../hooks/useUserTypes';
import Logo from '../common/Logo';

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  user_type_id: string;
  profile: {
    vehicle_type_id?: string;
    name?: string;
  };
}

const steps = ['Choose Persona', 'Personal Information', 'Review & Submit'];

const personaOptions = [
  {
    id: 'client',
    title: 'Client',
    description: 'I want to book transportation services',
    icon: <Person sx={{ fontSize: 40 }} />,
    color: '#1976d2',
  },
  {
    id: 'agent',
    title: 'Agent',
    description: 'I provide transportation services',
    icon: <LocalShipping sx={{ fontSize: 40 }} />,
    color: '#388e3c',
  },
  {
    id: 'business',
    title: 'Business',
    description: 'I manage a transportation business',
    icon: <Business sx={{ fontSize: 40 }} />,
    color: '#f57c00',
  },
];

const CompleteProfile: React.FC = () => {
  const { user } = useAuth0();
  const apiClient = useApiClient();
  const {
    userTypes,
    vehicleTypes,
    loading: typesLoading,
    error: typesError,
  } = useUserTypes();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: user?.given_name || '',
    last_name: user?.family_name || '',
    email: user?.email || '',
    user_type_id: '',
    profile: {},
  });

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
      profile: {}, // Reset profile data when persona changes
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
      // Use the POST /users API with the profile object format
      await apiClient.post('/users', profileData);
      setSuccess(true);

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/app';
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Failed to create user. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return profileData.user_type_id !== '';
      case 1:
        const hasRequiredFields =
          profileData.first_name &&
          profileData.last_name &&
          profileData.user_type_id;

        if (profileData.user_type_id === 'agent') {
          return hasRequiredFields && profileData.profile.vehicle_type_id;
        }

        if (profileData.user_type_id === 'business') {
          return hasRequiredFields && profileData.profile.name;
        }

        return hasRequiredFields;
      default:
        return true;
    }
  };

  const getSelectedPersona = () => {
    return personaOptions.find((p) => p.id === profileData.user_type_id);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" gutterBottom>
              Choose Your Persona
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select the type of account you want to create
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 2,
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" gutterBottom>
              Personal Information
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

            {profileData.user_type_id === 'agent' && (
              <FormControl fullWidth required>
                <InputLabel>Vehicle Type</InputLabel>
                <Select
                  value={profileData.profile.vehicle_type_id || ''}
                  label="Vehicle Type"
                  onChange={handleProfileChange('vehicle_type_id')}
                  disabled={typesLoading}
                >
                  {vehicleTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.comment}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

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

      case 2:
        const selectedPersona = getSelectedPersona();
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" gutterBottom>
              Review Your Information
            </Typography>

            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2" gutterBottom>
                <strong>Name:</strong> {profileData.first_name}{' '}
                {profileData.last_name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Persona:</strong> {selectedPersona?.title}
              </Typography>
              {profileData.user_type_id === 'agent' &&
                profileData.profile.vehicle_type_id && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Vehicle Type:</strong>{' '}
                    {
                      vehicleTypes.find(
                        (t) => t.id === profileData.profile.vehicle_type_id
                      )?.comment
                    }
                  </Typography>
                )}
              {profileData.user_type_id === 'business' &&
                profileData.profile.name && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Business Name:</strong> {profileData.profile.name}
                  </Typography>
                )}
            </Paper>
          </Box>
        );

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
        }}
      >
        <Paper
          sx={{
            p: 6,
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
        }}
      >
        <Paper
          sx={{
            p: 6,
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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper
        sx={{
          p: 4,
          maxWidth: 800,
          width: '100%',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ mb: 2 }}>
            <Logo variant="default" size="large" />
          </Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Complete Your Profile
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Please provide some additional information to complete your account
            setup
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {typesLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <CircularProgress />
          </Box>
        )}

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mb: 4 }}>{renderStepContent(activeStep)}</Box>

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
                {loading ? 'Creating...' : 'Complete Profile'}
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
      </Paper>
    </Box>
  );
};

export default CompleteProfile;
