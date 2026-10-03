import { Card, CardContent, Typography } from '@mui/material';
import React from 'react';

interface PerformanceMetricCardProps {
  label: string;
  value: React.ReactNode;
}

export const PerformanceMetricCard: React.FC<PerformanceMetricCardProps> = ({
  label,
  value,
}) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={700}>
        {value ?? '—'}
      </Typography>
    </CardContent>
  </Card>
);
