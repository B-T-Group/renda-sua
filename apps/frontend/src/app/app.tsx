import { Route, Routes, Link, Navigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { Home, Dashboard, Login, DirectionsCar, Person } from '@mui/icons-material';
import { Auth0Provider } from '@auth0/auth0-react';
import { auth0Config } from '../config/auth0.config';
import { Auth0Provider as CustomAuth0Provider } from '../contexts/Auth0Context';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { useAuth0Context } from '../contexts/Auth0Context';
import { Logo } from '../components/common/Logo';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth0Context();
  const theme = useTheme();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Logo height={80} sx={{ mb: 2 }} />
          <CircularProgress size={40} sx={{ color: 'white' }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ px: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Logo height={40} sx={{ mr: 2 }} />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 600,
                display: { xs: 'none', sm: 'block' }
              }}
            >
              Rendasua
            </Typography>
          </Box>
          
          {isAuthenticated ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                color="inherit" 
                component={Link} 
                to="/" 
                startIcon={<Home />}
                sx={{ 
                  borderRadius: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Home
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/dashboard" 
                startIcon={<Dashboard />}
                sx={{ 
                  borderRadius: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Dashboard
              </Button>
            </Box>
          ) : (
            <Button 
              color="inherit" 
              component={Link} 
              to="/login" 
              startIcon={<Login />}
              variant="outlined"
              sx={{ 
                borderRadius: 2,
                borderColor: 'rgba(255,255,255,0.3)',
                '&:hover': { 
                  borderColor: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)' 
                }
              }}
            >
              Sign In
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route
            path="/"
            element={
              <Box>
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                  <Logo height={120} sx={{ mb: 3 }} />
                  <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
                    Welcome to Rendasua
                  </Typography>
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
                    Your comprehensive transport and logistics solution platform
                  </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, mb: 6 }}>
                  <Box sx={{ textAlign: 'center', p: 4, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                    <DirectionsCar sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                      Transport Management
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Efficiently manage your fleet, routes, and deliveries with our advanced transport solutions.
                    </Typography>
                  </Box>
                  
                  <Box sx={{ textAlign: 'center', p: 4, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                    <Person sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                      User Management
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Seamlessly manage clients, agents, and business accounts with role-based access control.
                    </Typography>
                  </Box>
                </Box>

                {isAuthenticated ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <Button
                      variant="contained"
                      size="large"
                      component={Link}
                      to="/dashboard"
                      startIcon={<Dashboard />}
                      sx={{ 
                        px: 4, 
                        py: 1.5, 
                        fontSize: '1.1rem',
                        borderRadius: 3
                      }}
                    >
                      Go to Dashboard
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <Button
                      variant="contained"
                      size="large"
                      component={Link}
                      to="/login"
                      startIcon={<Login />}
                      sx={{ 
                        px: 4, 
                        py: 1.5, 
                        fontSize: '1.1rem',
                        borderRadius: 3
                      }}
                    >
                      Get Started
                    </Button>
                  </Box>
                )}
              </Box>
            }
          />
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginPage />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}

export function App() {
  return (
    <Auth0Provider {...auth0Config}>
      <CustomAuth0Provider>
        <AppContent />
      </CustomAuth0Provider>
    </Auth0Provider>
  );
}

export default App;
