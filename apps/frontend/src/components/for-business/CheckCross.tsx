import { CheckCircle, Close } from '@mui/icons-material';
import { Box } from '@mui/material';
import React from 'react';
import { FB_GREEN } from './forBusinessTheme';

interface CheckCrossProps {
  available: boolean;
  emphasize?: boolean;
}

const CheckCross: React.FC<CheckCrossProps> = ({ available, emphasize }) => (
  <Box
    component="span"
    aria-label={available ? 'yes' : 'no'}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: '50%',
      bgcolor: available
        ? emphasize
          ? FB_GREEN
          : 'rgba(22,163,74,0.12)'
        : 'action.hover',
      color: available ? (emphasize ? '#fff' : FB_GREEN) : 'text.disabled',
    }}
  >
    {available ? <CheckCircle sx={{ fontSize: 18 }} /> : <Close sx={{ fontSize: 16 }} />}
  </Box>
);

export default CheckCross;
