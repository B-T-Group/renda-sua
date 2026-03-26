import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../common/Logo';

const LoginPage: React.FC = () => {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    try {
      setError(null);
      await loginWithRedirect({
        authorizationParams: {
          login_hint: email || undefined,
          screen_hint: 'login',
        },
        appState: { returnTo: '/app' },
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to continue to login.');
    }
  };

  return (
    <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', background: 'linear-gradient(180deg, rgba(30,64,175,0.08), rgba(30,64,175,0.02))' }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4, boxShadow: 6 }}>
          <Stack spacing={2.5}>
            <Logo variant="with-tagline" size="medium" />
            <Typography variant="h4">Welcome back</Typography>
            <Typography color="text.secondary">Log in securely with a one-time passcode sent to your email.</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              fullWidth
            />
            <Button variant="contained" size="large" onClick={handleContinue}>
              Continue with OTP
            </Button>
            <Button variant="text" onClick={() => navigate('/signup')}>
              Create a new account
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
