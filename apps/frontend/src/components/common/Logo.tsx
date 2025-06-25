import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import rendasuaLogo from '../../assets/rendasua.svg';

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
    '& img': {
      height: '24px',
      width: 'auto',
    },
  }),
  ...($size === 'medium' && {
    '& .MuiTypography-root': {
      fontSize: '1.5rem',
    },
    '& img': {
      height: '32px',
      width: 'auto',
    },
  }),
  ...($size === 'large' && {
    '& .MuiTypography-root': {
      fontSize: '2rem',
    },
    '& img': {
      height: '48px',
      width: 'auto',
    },
  }),
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
      <img 
        src={rendasuaLogo} 
        alt="Rendasua Logo" 
        style={{ 
          filter: color === 'white' ? 'brightness(0) invert(1)' : 'none',
          opacity: color === 'white' ? 0.9 : 1,
        }}
      />
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