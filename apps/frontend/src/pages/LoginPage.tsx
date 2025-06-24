import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  useTheme,
} from '@mui/material';
import { Login, PersonAdd, DirectionsCar } from '@mui/icons-material';
import { LoginButton } from '../components/auth/LoginButton';
import { Logo } from '../components/common/Logo';

export const LoginPage: React.FC = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Logo height={100} sx={{ mb: 3 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'white', fontWeight: 700 }}>
            Welcome Back
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
            Sign in to your Rendasua account
          </Typography>
        </Box>

        <Card sx={{ 
          width: '100%', 
          maxWidth: 450, 
          mx: 'auto',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LoginButton
                fullWidth
                size="large"
                startIcon={<Login />}
                sx={{ 
                  py: 1.5,
                  fontSize: '1.1rem',
                  borderRadius: 2,
                }}
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
                sx={{ 
                  py: 1.5,
                  fontSize: '1.1rem',
                  borderRadius: 2,
                }}
              >
                Create Account
              </LoginButton>
            </Box>

            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </Typography>
            </Box>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <DirectionsCar sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Transport & Logistics Solutions
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}; 