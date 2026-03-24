import { Box, Paper, Stack, Typography } from '@mui/material';
import React from 'react';

export interface BusinessDashboardSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const BusinessDashboardSection: React.FC<BusinessDashboardSectionProps> = ({
  title,
  subtitle,
  children,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 2, sm: 3 },
      mb: 3,
      borderRadius: 2,
      border: 1,
      borderColor: 'divider',
    }}
  >
    <Stack spacing={0.75} sx={{ mb: 2.5 }}>
      <Typography
        variant="overline"
        color="primary"
        fontWeight={700}
        letterSpacing={0.08}
        sx={{ lineHeight: 1.4 }}
      >
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Stack>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{children}</Box>
  </Paper>
);

export default BusinessDashboardSection;
