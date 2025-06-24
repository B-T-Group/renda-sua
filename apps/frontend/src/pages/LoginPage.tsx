import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
} from '@mui/material';
import { Login, PersonAdd } from '@mui/icons-material';
import { LoginButton } from '../components/auth/LoginButton';

export const LoginPage: React.FC = () => {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" component="h1" gutterBottom>
                Welcome to Rendasua
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sign in to your account to continue
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LoginButton
                fullWidth
                size="large"
                startIcon={<Login />}
              >
                Sign In
              </LoginButton>

              <Divider sx={{ my: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  or
                </Typography>
              </Divider>

              <LoginButton
                fullWidth
                size="large"
                variant="outlined"
                startIcon={<PersonAdd />}
              >
                Sign Up
              </LoginButton>
            </Box>

            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}; 