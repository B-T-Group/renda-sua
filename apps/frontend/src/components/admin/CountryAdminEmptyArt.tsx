import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

/** A map pin over a country outline, for the empty country-admin list. */
const CountryAdminEmptyArt: React.FC = () => {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const soft = theme.palette.primary.light;
  return (
    <Box component="svg" viewBox="0 0 160 120" role="img" aria-hidden sx={{ width: 160, height: 120 }}>
      <ellipse cx="80" cy="100" rx="46" ry="8" fill={soft} opacity="0.45" />
      <path
        d="M28 62c8-22 24-34 52-34 20 0 36 8 48 24 6 8 8 18 4 28-6 14-22 22-40 24-22 2-40-6-52-20-8-8-14-14-12-22z"
        fill={soft}
        opacity="0.85"
      />
      <path d="M80 28c8 14 8 28 0 46-8-18-8-32 0-46z" fill={primary} />
      <circle cx="80" cy="36" r="10" fill={primary} />
      <circle cx="80" cy="36" r="4" fill={theme.palette.background.paper} />
    </Box>
  );
};

export default CountryAdminEmptyArt;
