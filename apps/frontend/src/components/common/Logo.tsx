import { Box, Chip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React from 'react';
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
      fontSize: '2.5rem',
    },
    '& img': {
      height: '56px',
      width: 'auto',
    },
  }),
}));

const LogoText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 800,
  letterSpacing: '-0.025em',
}));

const DeliveryTagline = styled(Chip)(({ theme }) => ({
  height: '24px',
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: theme.palette.secondary.main,
  color: theme.palette.secondary.contrastText,
  '& .MuiChip-label': {
    padding: '0 12px',
  },
}));

const Logo: React.FC<LogoProps> = ({
  variant = 'default',
  color = 'primary',
  size = 'medium',
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      <LogoContainer size={size}>
        <img
          src={rendasuaLogo}
          alt="Rendasua Logo"
          style={{
            filter: isWhiteVariant ? 'brightness(0) invert(1)' : 'none',
            opacity: isWhiteVariant ? 0.95 : 1,
          }}
        />
        {variant !== 'compact' && (
          <LogoText
            variant="h6"
            sx={{
              color: isWhiteVariant ? 'white' : undefined,
              background: isWhiteVariant ? 'none' : undefined,
              WebkitTextFillColor: isWhiteVariant ? 'white' : undefined,
              fontWeight: isWhiteVariant ? 700 : 800,
            }}
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
            backgroundColor: isWhiteVariant
              ? 'rgba(255,255,255,0.15)'
              : undefined,
            color: isWhiteVariant ? 'white' : undefined,
            border: isWhiteVariant
              ? '1px solid rgba(255,255,255,0.2)'
              : undefined,
            fontWeight: 600,
          }}
        />
      )}
    </Box>
  );
};

export default Logo;
