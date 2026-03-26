import { Box, CircularProgress, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { useAuthFlow } from '../../hooks/useAuthFlow';
import { useApiClient } from '../../hooks/useApiClient';

const AppRedirect: React.FC = () => {
  const { isCheckingProfile } = useAuthFlow();
  const apiClient = useApiClient();

  useEffect(() => {
    const pendingSignupUserId = sessionStorage.getItem('pendingSignupUserId');
    if (!pendingSignupUserId) return;
    apiClient
      .post('/auth/signup/complete', { userId: pendingSignupUserId })
      .then(() => {
        sessionStorage.removeItem('pendingSignupUserId');
        sessionStorage.removeItem('pendingSignupEmail');
      })
      .catch(() => {
        // Keep silent; regular auth flow still continues.
      });
  }, [apiClient]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body1" color="text.secondary">
        {isCheckingProfile ? 'Checking your profile...' : 'Redirecting...'}
      </Typography>
    </Box>
  );
};

export default AppRedirect;
