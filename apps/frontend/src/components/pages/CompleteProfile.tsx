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
} from '@mui/material';
import { Save, ArrowForward } from '@mui/icons-material';
import { useAuth0 } from '@auth0/auth0-react';
import { useApiClient } from '../../hooks/useApiClient';
import Logo from '../common/Logo';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userType: string;
  businessName?: string;
  address?: string;
}

const steps = ['Personal Information', 'Business Details', 'Review & Submit'];

const userTypes = [
  { value: 'client', label: 'Client' },
  { value: 'agent', label: 'Agent' },
  { value: 'business', label: 'Business Owner' },
];

const CompleteProfile: React.FC = () => {
  const { user } = useAuth0();
  const apiClient = useApiClient();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: user?.given_name || '',
    lastName: user?.family_name || '',
    email: user?.email || '',
    phone: '',
    userType: '',
    businessName: '',
    address: '',
  });

  const handleInputChange = (field: keyof ProfileData) => (
    event: React.ChangeEvent<HTMLInputElement> | { target: { value: unknown } }
  ) => {
    setProfileData({
      ...profileData,
      [field]: event.target.value,
    });
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.post('/users/profile', profileData);
      setSuccess(true);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return profileData.firstName && profileData.lastName && profileData.email && profileData.phone;
      case 1:
        return profileData.userType && (profileData.userType !== 'business' || profileData.businessName);
      default:
        return true;
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>
            
            <TextField
              label="First Name"
              value={profileData.firstName}
              onChange={handleInputChange('firstName')}
              fullWidth
              required
            />
            
            <TextField
              label="Last Name"
              value={profileData.lastName}
              onChange={handleInputChange('lastName')}
              fullWidth
              required
            />
            
            <TextField
              label="Email"
              type="email"
              value={profileData.email}
              onChange={handleInputChange('email')}
              fullWidth
              required
              disabled
            />
            
            <TextField
              label="Phone Number"
              value={profileData.phone}
              onChange={handleInputChange('phone')}
              fullWidth
              required
              placeholder="+1234567890"
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" gutterBottom>
              Business Details
            </Typography>
            
            <FormControl fullWidth required>
              <InputLabel>User Type</InputLabel>
              <Select
                value={profileData.userType}
                label="User Type"
                onChange={handleInputChange('userType')}
              >
                {userTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {profileData.userType === 'business' && (
              <TextField
                label="Business Name"
                value={profileData.businessName}
                onChange={handleInputChange('businessName')}
                fullWidth
                required
              />
            )}
            
            <TextField
              label="Address"
              value={profileData.address}
              onChange={handleInputChange('address')}
              fullWidth
              multiline
              rows={3}
              placeholder="Enter your address"
            />
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" gutterBottom>
              Review Your Information
            </Typography>
            
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2" gutterBottom>
                <strong>Name:</strong> {profileData.firstName} {profileData.lastName}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Email:</strong> {profileData.email}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Phone:</strong> {profileData.phone}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>User Type:</strong> {userTypes.find(t => t.value === profileData.userType)?.label}
              </Typography>
              {profileData.businessName && (
                <Typography variant="body2" gutterBottom>
                  <strong>Business Name:</strong> {profileData.businessName}
                </Typography>
              )}
              {profileData.address && (
                <Typography variant="body2" gutterBottom>
                  <strong>Address:</strong> {profileData.address}
                </Typography>
              )}
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

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
            Your profile has been successfully created. Redirecting to dashboard...
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
          maxWidth: 600,
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
            Please provide some additional information to complete your account setup
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mb: 4 }}>
          {renderStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          
          <Box>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading || !isStepValid(activeStep)}
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              >
                {loading ? 'Saving...' : 'Complete Profile'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStepValid(activeStep)}
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