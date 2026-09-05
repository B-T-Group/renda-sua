import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { FB_ACCENT } from './forBusinessTheme';

interface StatItemProps {
  value: string;
  label: string;
}

/** Single metric value + label for the trust strip. */
const StatItem: React.FC<StatItemProps> = ({ value, label }) => (
  <Box sx={{ textAlign: 'center', px: 1.5, py: 2, minWidth: 120 }}>
    <Typography
      component="p"
      sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800, color: FB_ACCENT, lineHeight: 1.1 }}
    >
      {value}
    </Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, fontWeight: 500 }}>
      {label}
    </Typography>
  </Box>
);

export const StatStrip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: { xs: 1, md: 2 },
      borderRadius: 3,
      border: '1.5px solid',
      borderColor: 'divider',
      bgcolor: alpha(FB_ACCENT, 0.04),
      py: 1,
      px: 1,
    }}
  >
    {children}
  </Box>
);

export default StatItem;
