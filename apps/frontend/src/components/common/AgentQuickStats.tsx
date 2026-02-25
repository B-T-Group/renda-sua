import {
  Box,
  Card,
  CardContent,
  CircularProgress,
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
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={72}>
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
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
          {t('agent.earnings.quickStats', 'Quick stats')}
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={2} alignItems="baseline">
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('agent.earnings.todaysDeliveries', "Today's deliveries")}
            </Typography>
            <Typography variant="h6" fontWeight="600" component="span">
              {todayDeliveries}
            </Typography>
          </Box>
          <Box sx={{ borderLeft: 1, borderColor: 'divider', pl: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('agent.earnings.avgCommission', 'Avg. commission (today)')}
            </Typography>
            <Typography variant="h6" fontWeight="600" component="span">
              {avgCommission != null
                ? formatCurrency(avgCommission, summary.currency)
                : '—'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AgentQuickStats;
