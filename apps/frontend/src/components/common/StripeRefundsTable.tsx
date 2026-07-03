import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
} from '@mui/material';
import { useApiClient } from '../../hooks';

export interface StripeRefund {
  id: string;
  stripe_refund_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  cancellation_fee: number;
  cancelled_by: string;
  created_at: string;
}

export interface StripeRefundsTableProps {
  orderId: string;
}

const StripeRefundsTable: React.FC<StripeRefundsTableProps> = ({ orderId }) => {
  const { t } = useTranslation();
  const { apiClient } = useApiClient();
  const [refunds, setRefunds] = useState<StripeRefund[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRefunds = async () => {
      if (!orderId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/stripe-payments/refund/order/${orderId}`);
        if (response.data?.success && response.data?.data) {
          setRefunds(response.data.data);
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            t('stripe.refunds.loadError', 'Failed to load refunds')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRefunds();
  }, [orderId, apiClient, t]);

  const getStatusChipColor = (
    status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  ): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (status) {
      case 'succeeded':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'default';
      case 'pending':
      default:
        return 'warning';
    }
  };

  const getStatusLabel = (status: string): string => {
    return t(`stripe.refunds.status.${status}`, status);
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (refunds.length === 0) {
    return (
      <Alert severity="info">
        {t('stripe.refunds.noRefunds', 'No refunds found for this order')}
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('stripe.refunds.title', 'Refund History')}
        subheader={t(
          'stripe.refunds.subtitle',
          'Track the status of refunds for this order'
        )}
      />
      <CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>
                  {t('stripe.refunds.columns.amount', 'Amount')}
                </TableCell>
                <TableCell>
                  {t('stripe.refunds.columns.fee', 'Fee Deducted')}
                </TableCell>
                <TableCell>
                  {t('stripe.refunds.columns.netRefund', 'Net Refund')}
                </TableCell>
                <TableCell>
                  {t('stripe.refunds.columns.status', 'Status')}
                </TableCell>
                <TableCell>
                  {t('stripe.refunds.columns.refundId', 'Refund ID')}
                </TableCell>
                <TableCell>
                  {t('stripe.refunds.columns.date', 'Date')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {refunds.map((refund) => {
                const netRefund = refund.amount - refund.cancellation_fee;
                return (
                  <TableRow key={refund.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {refund.amount.toLocaleString()} {refund.currency}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {refund.cancellation_fee > 0
                          ? `${refund.cancellation_fee.toLocaleString()} ${refund.currency}`
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {netRefund.toLocaleString()} {refund.currency}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(refund.status)}
                        color={getStatusChipColor(refund.status)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {refund.stripe_refund_id?.substring(0, 12)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(refund.created_at)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default StripeRefundsTable;
