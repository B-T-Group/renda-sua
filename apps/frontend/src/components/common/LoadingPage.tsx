import { Box, CircularProgress, Typography } from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';
import React from 'react';

// Simple fade in animation
const fadeIn = keyframes`
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

const LoadingContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(8px)',
  zIndex: 9999,
  animation: `${fadeIn} 0.3s ease-out`,
}));

const LoadingContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
  textAlign: 'center',
}));

const LoadingText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 500,
  animation: `${fadeIn} 0.5s ease-out 0.2s both`,
}));

interface LoadingPageProps {
  message?: string;
  subtitle?: string;
  showProgress?: boolean;
}

const LoadingPage: React.FC<LoadingPageProps> = ({
  message = 'Loading...',
  subtitle,
  showProgress = true,
}) => {
  return (
    <LoadingContainer>
      <LoadingContent>
        {showProgress && (
          <CircularProgress
            size={32}
            thickness={4}
            sx={{
              color: 'primary.main',
              animation: `${fadeIn} 0.3s ease-out`,
            }}
          />
        )}
        <LoadingText variant="body1">{message}</LoadingText>
        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              animation: `${fadeIn} 0.5s ease-out 0.3s both`,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </LoadingContent>
    </LoadingContainer>
  );
};

export default LoadingPage;
