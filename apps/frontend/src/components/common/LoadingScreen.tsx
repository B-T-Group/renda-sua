import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface LoadingScreenProps {
  open: boolean;
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ open, message }) => {
  const { t } = useTranslation();

  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
      }}
      open={open}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <CircularProgress color="inherit" size={60} />
        <Typography variant="h6" color="inherit">
          {message || t('common.loading')}
        </Typography>
      </Box>
    </Backdrop>
  );
};

export default LoadingScreen;
