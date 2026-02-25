import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentEarningsSummary } from '../../hooks/useAgentEarningsSummary';

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

interface AgentQuickStatsProps {
  summary: AgentEarningsSummary | null;
  loading: boolean;
  error: string | null;
}

const AgentQuickStats: React.FC<AgentQuickStatsProps> = ({
  summary,
  loading,
  error,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card variant="outlined" sx={{ width: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={80}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return null;
  }

  const todayDeliveries = summary.todayDeliveryCount;
  const avgCommission =
    todayDeliveries > 0
      ? summary.todayEarnings / todayDeliveries
      : null;

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('agent.earnings.quickStats', 'Quick stats')}
        </Typography>
        <Grid container spacing={2} sx={{ width: '100%' }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('agent.earnings.todaysDeliveries', "Today's deliveries")}
            </Typography>
            <Typography variant="h6" fontWeight="600">
              {todayDeliveries}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('agent.earnings.avgCommission', 'Avg. commission (today)')}
            </Typography>
            <Typography variant="h6" fontWeight="600">
              {avgCommission != null
                ? formatCurrency(avgCommission, summary.currency)
                : '—'}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default AgentQuickStats;
