import { Route, Routes, Link, Navigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  CircularProgress,
} from '@mui/material';
import { Home, Dashboard, Login } from '@mui/icons-material';
import { Auth0Provider } from '@auth0/auth0-react';
import { auth0Config } from '../config/auth0.config';
import { Auth0Provider as CustomAuth0Provider } from '../contexts/Auth0Context';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { useAuth0Context } from '../contexts/Auth0Context';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth0Context();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Rendasua App
          </Typography>
          {isAuthenticated ? (
            <>
              <Button color="inherit" component={Link} to="/" startIcon={<Home />}>
                Home
              </Button>
              <Button color="inherit" component={Link} to="/dashboard" startIcon={<Dashboard />}>
                Dashboard
              </Button>
            </>
          ) : (
            <Button color="inherit" component={Link} to="/login" startIcon={<Login />}>
              Login
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
                <Typography variant="h4" component="h1" gutterBottom>
                  Welcome to Rendasua
                </Typography>
                <Typography variant="body1" paragraph>
                  This is your React frontend application with Auth0 integration and Material-UI.
                </Typography>
                {isAuthenticated ? (
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      component={Link}
                      to="/dashboard"
                      startIcon={<Dashboard />}
                    >
                      Go to Dashboard
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      component={Link}
                      to="/login"
                      startIcon={<Login />}
                    >
                      Sign In
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
