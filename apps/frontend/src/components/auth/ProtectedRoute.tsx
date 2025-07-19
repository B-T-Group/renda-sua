import { useAuth0 } from '@auth0/auth0-react';
import { Lock } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import React from 'react';
import LoadingPage from '../common/LoadingPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <LoadingPage
        message="Authenticating"
        subtitle="Please wait while we verify your credentials"
        showProgress={true}
      />
    );
  }

  if (!isAuthenticated) {
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

  return <>{children}</>;
};

export default ProtectedRoute;
