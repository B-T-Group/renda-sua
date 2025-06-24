import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import logo from '../../assets/logo.svg';

interface LogoProps {
  height?: number | string;
  width?: number | string;
  sx?: SxProps<Theme>;
}

export const Logo: React.FC<LogoProps> = ({ 
  height = 40, 
  width = 'auto',
  sx = {} 
}) => {
  return (
    <Box
      component="img"
      src={logo}
      alt="Rendasua Logo"
      sx={{
        height,
        width,
        ...sx,
      }}
    />
  );
}; 