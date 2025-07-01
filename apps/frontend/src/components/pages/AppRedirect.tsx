import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import { useAuthFlow } from '../../hooks/useAuthFlow';

const AppRedirect: React.FC = () => {
  const { isCheckingProfile } = useAuthFlow();

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
