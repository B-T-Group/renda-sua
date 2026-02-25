import { AttachMoney, ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Collapse,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
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
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  if (error) {
    return (
      <Card variant="outlined" sx={{ width: '100%' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
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
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
          <AttachMoney color="primary" sx={{ fontSize: 20 }} />
          <Typography variant="subtitle1" component="h2" fontWeight="600">
            {t('agent.earnings.todaysEarnings', "Today's Earnings")}
          </Typography>
        </Box>
        <Typography variant="h5" fontWeight="bold" color="primary.main">
          {formatCurrency(summary.todayEarnings, summary.currency)}
        </Typography>
        {summary.recentCommissions.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => setDetailsOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailsOpen((o) => !o);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                cursor: 'pointer',
                color: 'text.secondary',
                typography: 'caption',
                '&:hover': { color: 'text.primary' },
              }}
              aria-expanded={detailsOpen}
              aria-label={detailsOpen ? t('agent.earnings.collapseDetails', 'Collapse details') : t('agent.earnings.expandDetails', 'Expand details')}
            >
              {t('agent.earnings.recentCommissions', 'Recent commissions')}
              {detailsOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </Box>
            <Collapse in={detailsOpen}>
              <Box component="ul" sx={{ m: 0, mt: 0.25, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {summary.recentCommissions.slice(0, 5).map((rc) => (
                  <Box
                    key={rc.orderId}
                    component="li"
                    display="flex"
                    justifyContent="space-between"
                    alignItems="baseline"
                    sx={{ typography: 'body2', fontSize: '0.8125rem' }}
                  >
                    <span>#{rc.orderNumber}</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(rc.amount, summary.currency)}</span>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentEarningsWidget;
