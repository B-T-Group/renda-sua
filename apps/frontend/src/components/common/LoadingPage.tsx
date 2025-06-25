import React from 'react';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Paper,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import Logo from './Logo';

// Pulse animation for the logo
const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

// Fade in animation for text
const fadeIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

const LoadingContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  position: 'relative',
  overflow: 'hidden',
}));

const LoadingContent = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(6),
  textAlign: 'center',
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  maxWidth: 400,
  width: '90%',
  animation: `${fadeIn} 0.6s ease-out`,
}));

const LogoContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  animation: `${pulse} 2s ease-in-out infinite`,
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const LoadingText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(2),
  animation: `${fadeIn} 0.8s ease-out 0.2s both`,
}));

const SubtitleText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(1),
  animation: `${fadeIn} 0.8s ease-out 0.4s both`,
}));

interface LoadingPageProps {
  message?: string;
  subtitle?: string;
  showProgress?: boolean;
}

const LoadingPage: React.FC<LoadingPageProps> = ({
  message = 'Loading Rendasua',
  subtitle = 'Please wait while we prepare your experience',
  showProgress = true,
}) => {
  return (
    <LoadingContainer>
      <LoadingContent elevation={0}>
        <LogoContainer>
          <Logo variant="default" size="large" />
        </LogoContainer>
        
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            animation: `${fadeIn} 0.8s ease-out 0.1s both`,
          }}
        >
          {message}
        </Typography>
        
        <SubtitleText variant="body1">
          {subtitle}
        </SubtitleText>
        
        {showProgress && (
          <ProgressContainer>
            <CircularProgress
              size={40}
              thickness={4}
              sx={{
                color: 'primary.main',
                animation: `${fadeIn} 0.8s ease-out 0.6s both`,
              }}
            />
            <LoadingText variant="body2">
              Initializing...
            </LoadingText>
          </ProgressContainer>
        )}
      </LoadingContent>
    </LoadingContainer>
  );
};

export default LoadingPage; 