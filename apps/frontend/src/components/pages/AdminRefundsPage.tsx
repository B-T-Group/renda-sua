import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import SEOHead from '../seo/SEOHead';

interface RefundMetrics {
  totalRequests: number;
  pending: number;
  completed: number;
  rejected: number;
  failedPayments: number;
  approvalRate: number;
  rejectionRate: number;
}

interface FailedPaymentRow {
  id: string;
  amount: number;
  currency: string;
  failure_reason?: string | null;
  destination: string;
  refund_request?: {
    order?: { id: string; order_number: string };
  };
}

const AdminRefundsPage: React.FC = () => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [metrics, setMetrics] = useState<RefundMetrics | null>(null);
  const [failed, setFailed] = useState<FailedPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    try {
      const [metricsRes, failedRes] = await Promise.all([
        apiClient.get('/admin/refunds/metrics'),
        apiClient.get('/admin/refunds/failed-payments'),
      ]);
      setMetrics(metricsRes.data.metrics);
      setFailed(failedRes.data.payments ?? []);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (paymentId: string) => {
    if (!apiClient) return;
    setRetryingId(paymentId);
    try {
      await apiClient.post(`/admin/refunds/payments/${paymentId}/retry`);
      await load();
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <SEOHead title={t('admin.refunds.title', 'Refund management')} />
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {t('admin.refunds.title', 'Refund management')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.refunds.subtitle', 'Monitor refund cases, Stripe failures, and retry payments.')}
      </Typography>

      {loading ? (
        <Skeleton height={160} />
      ) : metrics ? (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: t('admin.refunds.metrics.total', 'Total requests'), value: metrics.totalRequests },
            { label: t('admin.refunds.metrics.pending', 'Pending'), value: metrics.pending },
            { label: t('admin.refunds.metrics.completed', 'Completed'), value: metrics.completed },
            { label: t('admin.refunds.metrics.failed', 'Failed payments'), value: metrics.failedPayments },
          ].map((m) => (
            <Grid key={m.label} size={{ xs: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    {m.label}
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {m.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : null}

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('admin.refunds.failedQueue', 'Failed refund payments')}
      </Typography>
      {failed.length === 0 && !loading ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('admin.refunds.noFailures', 'No failed refund payments.')}
        </Alert>
      ) : (
        <TableContainer component={Card} sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.refunds.order', 'Order')}</TableCell>
                <TableCell>{t('admin.refunds.amount', 'Amount')}</TableCell>
                <TableCell>{t('admin.refunds.destination', 'Destination')}</TableCell>
                <TableCell>{t('admin.refunds.error', 'Error')}</TableCell>
                <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {failed.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.refund_request?.order ? (
                      <Button
                        component={RouterLink}
                        to={`/orders/${row.refund_request.order.id}`}
                        size="small"
                      >
                        {row.refund_request.order.order_number}
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {row.amount} {row.currency}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={row.destination} />
                  </TableCell>
                  <TableCell>{row.failure_reason ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={retryingId === row.id}
                      onClick={() => retry(row.id)}
                    >
                      {t('admin.refunds.retry', 'Retry')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

    </Container>
  );
};

export default AdminRefundsPage;
