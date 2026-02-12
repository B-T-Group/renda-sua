import {
  Box,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import SEOHead from '../seo/SEOHead';

interface BusinessAnalytics {
  orderCountByStatus: Array<{ status: string; count: number }>;
  totalRevenue: number;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  topItems: Array<{
    itemName: string;
    quantity: number;
    totalRevenue: number;
  }>;
  revenueByPeriod: Array<{
    period: string;
    revenue: number;
    count: number;
  }>;
}

const BusinessAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [data, setData] = useState<BusinessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await apiClient.get<BusinessAnalytics>('/analytics/business');
        if (!cancelled) setData(res.data);
      } catch (err: any) {
        if (!cancelled)
          setError(err.response?.data?.message ?? err.message ?? 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  if (loading) {
    return (
      <Box py={4}>
        <Typography color="text.secondary">
          {t('common.loading', 'Loading...')}
        </Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box py={4}>
        <Typography color="error">{error ?? 'No data'}</Typography>
      </Box>
    );
  }

  const successRate =
    data.orderCount > 0
      ? ((data.deliveredCount / data.orderCount) * 100).toFixed(1)
      : '0';

  return (
    <>
      <SEOHead
        title={t('business.analytics.title', 'Business Analytics')}
        description={t(
          'business.analytics.description',
          'View sales, orders, and delivery performance'
        )}
      />
      <Box py={3}>
        <Typography variant="h4" gutterBottom>
          {t('business.analytics.title', 'Business Analytics')}
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {t('business.analytics.totalOrders', 'Total Orders')}
                </Typography>
                <Typography variant="h4">{data.orderCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {t('business.analytics.delivered', 'Delivered')}
                </Typography>
                <Typography variant="h4">{data.deliveredCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {t('business.analytics.totalRevenue', 'Total Revenue')}
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(data.totalRevenue)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {t('business.analytics.successRate', 'Delivery Success Rate')}
                </Typography>
                <Typography variant="h4">{successRate}%</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.analytics.ordersByStatus', 'Orders by Status')}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.status', 'Status')}</TableCell>
                    <TableCell align="right">{t('common.count', 'Count')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.orderCountByStatus.map((row) => (
                    <TableRow key={row.status}>
                      <TableCell>{row.status}</TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.analytics.topItems', 'Top Items')}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.item', 'Item')}</TableCell>
                    <TableCell align="right">{t('common.quantity', 'Qty')}</TableCell>
                    <TableCell align="right">{t('common.revenue', 'Revenue')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.topItems.slice(0, 10).map((row, idx) => (
                    <TableRow key={`${row.itemName}-${idx}`}>
                      <TableCell>{row.itemName}</TableCell>
                      <TableCell align="right">{row.quantity}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(row.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.analytics.revenueByMonth', 'Revenue by Month')}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('business.analytics.period', 'Period')}</TableCell>
                    <TableCell align="right">{t('common.orders', 'Orders')}</TableCell>
                    <TableCell align="right">{t('common.revenue', 'Revenue')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.revenueByPeriod.map((row) => (
                    <TableRow key={row.period}>
                      <TableCell>{row.period}</TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(row.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

export default BusinessAnalyticsPage;
