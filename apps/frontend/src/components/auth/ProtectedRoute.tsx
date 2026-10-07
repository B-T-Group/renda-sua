import { Lock } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocation } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import LoadingPage from '../common/LoadingPage';
import EmailVerificationPage from '../pages/EmailVerificationPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isSessionReady, isLoading, user } = useSessionAuth();
  const { t } = useTranslation();
  const { loginWithRedirect } = useAuth0();
  const location = useLocation();

  if (isLoading || !isSessionReady) {
    return <LoadingPage message="Authenticating" />;
  }

  if (!isAuthenticated) {
    // #338 decision 4: admins stay on Auth0 Universal Login (not the in-app code gate).
    const isAdminRoute =
      location.pathname.startsWith('/admin/') ||
      location.pathname.startsWith('/business/dashboard/admin');

    if (isAdminRoute) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="50vh"
          gap={2}
        >
          <Lock color="action" sx={{ fontSize: 64 }} />
          <Typography variant="h5" component="h2" gutterBottom>
            {t('auth.adminSignIn.title', 'Sign in required')}
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            {t(
              'auth.adminSignIn.description',
              'You need to sign in to access this admin page.'
            )}
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() =>
              void loginWithRedirect({
                appState: {
                  returnTo: location.pathname + location.search,
                },
              })
            }
          >
            {t('auth.adminSignIn.cta', 'Sign in')}
          </Button>
        </Box>
      );
    }

    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
        gap={2}
      >
        <Lock color="action" sx={{ fontSize: 64 }} />
        <Typography variant="h5" component="h2" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          You need to be logged in to access this page.
        </Typography>
      </Box>
    );
  }

  // Only block when the user has an email and it is explicitly unverified.
  if (user?.email && user.email_verified === false) {
    console.log(
      'User email is not verified, redirecting to email verification page',
      user
    );
    return <EmailVerificationPage />;
  }

  return children;
};

export default ProtectedRoute;
