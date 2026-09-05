import { Box, Stack, Typography } from '@mui/material';
import React from 'react';

export interface OrderStatsTileProps {
  label: string;
  value: string;
  caption?: string | null;
  /** Theme path for the accent dot, e.g. "success.main". Omit for no dot. */
  accent?: string;
}

/** Compact metric cell: quiet label, loud number, optional supporting caption. */
export const OrderStatsTile: React.FC<OrderStatsTileProps> = ({
  label,
  value,
  caption,
  accent,
}) => (
  <Box sx={{ minWidth: 0 }}>
    <Stack direction="row" spacing={0.75} alignItems="center">
      {accent && (
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: accent,
            flexShrink: 0,
          }}
        />
      )}
      <Typography variant="body2" color="text.secondary" noWrap>
        {label}
      </Typography>
    </Stack>
    <Typography variant="h5" sx={{ mt: 0.25, fontWeight: 600 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {caption || '\u00A0'}
    </Typography>
  </Box>
);
