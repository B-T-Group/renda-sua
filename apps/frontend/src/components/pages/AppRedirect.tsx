import { Box, CircularProgress, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { useAuthFlow } from '../../hooks/useAuthFlow';

const AppRedirect: React.FC = () => {
  const { isCheckingProfile } = useAuthFlow();

  useEffect(() => {
    const pendingSignupAttemptId = sessionStorage.getItem('pendingSignupAttemptId');
    const pendingSignupUserId = sessionStorage.getItem('pendingSignupUserId');
    if (!pendingSignupAttemptId && !pendingSignupUserId) return;
    sessionStorage.removeItem('pendingSignupAttemptId');
    sessionStorage.removeItem('pendingSignupUserId');
    sessionStorage.removeItem('pendingSignupEmail');
    sessionStorage.removeItem('pendingSignupPhone');
    sessionStorage.removeItem('pendingSignupOtpExpiresAtMs');
    sessionStorage.removeItem('pendingSignupOtpResendAtMs');
    sessionStorage.removeItem('pendingSignupLaunchPromo');
  }, []);

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
