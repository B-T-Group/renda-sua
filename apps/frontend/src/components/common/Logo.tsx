import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import rendasuaLogo from '../../assets/rendasua.svg';

interface LogoProps {
  variant?: 'default' | 'compact' | 'with-tagline';
  color?: 'primary' | 'secondary' | 'white';
  size?: 'small' | 'medium' | 'large';
}

interface LogoContainerProps {
  size: string;
}

const LogoContainer = styled(Box)<LogoContainerProps>(({ theme, size }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  ...(size === 'small' && {
    '& .MuiTypography-root': {
      fontSize: '1rem',
    },
    '& img': {
      height: '24px',
      width: 'auto',
    },
  }),
  ...(size === 'medium' && {
    '& .MuiTypography-root': {
      fontSize: '1.5rem',
    },
    '& img': {
      height: '32px',
      width: 'auto',
    },
  }),
  ...(size === 'large' && {
    '& .MuiTypography-root': {
      fontSize: '2rem',
    },
    '& img': {
      height: '48px',
      width: 'auto',
    },
  }),
}));

const LogoText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 700,
  letterSpacing: '-0.025em',
}));

const DeliveryTagline = styled(Chip)(({ theme }) => ({
  height: '20px',
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: theme.palette.secondary.main,
  color: theme.palette.secondary.contrastText,
  '& .MuiChip-label': {
    padding: '0 8px',
  },
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

  const isWhiteVariant = color === 'white';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
      <LogoContainer size={size}>
        <img 
          src={rendasuaLogo} 
          alt="Rendasua Logo" 
          style={{ 
            filter: isWhiteVariant ? 'brightness(0) invert(1)' : 'none',
            opacity: isWhiteVariant ? 0.9 : 1,
          }}
        />
        {variant !== 'compact' && (
          <LogoText 
            variant="h6" 
            sx={{
              color: isWhiteVariant ? 'white' : undefined,
              background: isWhiteVariant ? 'none' : undefined,
              WebkitTextFillColor: isWhiteVariant ? 'white' : undefined,
            }}
            fontWeight={600}
          >
            Renda Sua
          </LogoText>
        )}
      </LogoContainer>
      {variant === 'with-tagline' && (
        <DeliveryTagline 
          label="Fast Delivery Service" 
          size="small"
          sx={{
            backgroundColor: isWhiteVariant ? 'rgba(255,255,255,0.2)' : undefined,
            color: isWhiteVariant ? 'white' : undefined,
          }}
        />
      )}
    </Box>
  );
};

export default Logo; 