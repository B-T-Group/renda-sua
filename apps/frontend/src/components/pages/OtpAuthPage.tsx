import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Button, CircularProgress, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import Logo from '../common/Logo';

const OtpAuthPage: React.FC = () => {
  const apiClient = useApiClient();
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const flow = search.get('flow') || 'login';
  const [email, setEmail] = useState(sessionStorage.getItem('pendingSignupEmail') || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = sessionStorage.getItem('pendingSignupUserId') || undefined;
      await apiClient.post('/auth/signup/verify-otp', { email, otp, userId });
      await loginWithRedirect({
        authorizationParams: {
          login_hint: email,
          screen_hint: 'login',
        },
        appState: { returnTo: '/app' },
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Logo variant="default" size="medium" />
          <Typography variant="h4">{flow === 'signup' ? 'Verify your account' : 'Log in with OTP'}</Typography>
          <Typography color="text.secondary">Enter the OTP sent to your email.</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="OTP code" value={otp} onChange={(e) => setOtp(e.target.value)} />
          <Button variant="contained" size="large" onClick={handleVerify} disabled={loading || !email || !otp} startIcon={loading ? <CircularProgress size={18} /> : undefined}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>
          <Button onClick={() => navigate('/auth/login')}>Back to login</Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default OtpAuthPage;
