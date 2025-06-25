import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface LogoProps {
  variant?: 'default' | 'compact';
  color?: 'primary' | 'secondary' | 'white';
  size?: 'small' | 'medium' | 'large';
}

const LogoContainer = styled(Box)<{ $size: string }>(({ theme, $size }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  ...($size === 'small' && {
    '& .MuiTypography-root': {
      fontSize: '1rem',
    },
  }),
  ...($size === 'medium' && {
    '& .MuiTypography-root': {
      fontSize: '1.5rem',
    },
  }),
  ...($size === 'large' && {
    '& .MuiTypography-root': {
      fontSize: '2rem',
    },
  }),
}));

const LogoIcon = styled(Box)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.primary.contrastText,
  fontWeight: 'bold',
  fontSize: '1.2rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
}));

const Logo: React.FC<LogoProps> = ({ 
  variant = 'default', 
  color = 'primary', 
  size = 'medium' 
}) => {
  const getTextColor = () => {
    switch (color) {
      case 'white':
        return 'white';
      case 'secondary':
        return 'secondary.main';
      default:
        return 'primary.main';
    }
  };

  return (
    <LogoContainer $size={size}>
      <LogoIcon>R</LogoIcon>
      {variant === 'default' && (
        <Typography 
          variant="h6" 
          component="span" 
          color={getTextColor()}
          fontWeight={600}
        >
          Rendasua
        </Typography>
      )}
    </LogoContainer>
  );
};

export default Logo; 