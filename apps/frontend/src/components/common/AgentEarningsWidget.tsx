import { AttachMoney } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
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

interface AgentEarningsWidgetProps {
  summary: AgentEarningsSummary | null;
  loading: boolean;
  error: string | null;
}

const AgentEarningsWidget: React.FC<AgentEarningsWidgetProps> = ({
  summary,
  loading,
  error,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card variant="outlined" sx={{ width: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={120}>
            <CircularProgress size={32} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined" sx={{ width: '100%' }}>
        <CardContent>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <AttachMoney color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" component="h2">
            {t('agent.earnings.todaysEarnings', "Today's Earnings")}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight="bold" color="primary.main">
          {formatCurrency(summary.todayEarnings, summary.currency)}
        </Typography>
        {summary.recentCommissions.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>
              {t('agent.earnings.recentCommissions', 'Recent commissions')}
            </Typography>
            <List dense disablePadding>
              {summary.recentCommissions.slice(0, 5).map((rc) => (
                <ListItem key={rc.orderId} disablePadding sx={{ py: 0 }}>
                  <ListItemText
                    primary={`#${rc.orderNumber}`}
                    secondary={formatCurrency(rc.amount, summary.currency)}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentEarningsWidget;
