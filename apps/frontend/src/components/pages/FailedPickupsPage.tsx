import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import SEOHead from '../seo/SEOHead';

interface FailedPickupRow {
  id: string;
  order_id: string;
  refund_amount: number;
  fee_retained: number;
  currency: string;
  fulfillment_method?: string | null;
  created_at: string;
  order?: {
    order_number: string;
    total_amount: number;
    client?: {
      user?: { first_name?: string; last_name?: string };
    };
  };
  failure_reason?: {
    reason_key: string;
    reason_en: string;
    reason_fr: string;
  };
}

const FailedPickupsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const apiClient = useApiClient();
  const [rows, setRows] = useState<FailedPickupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFr = i18n.language?.startsWith('fr');

  useEffect(() => {
    if (!profile?.business?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<{ success: boolean; failed_pickups: FailedPickupRow[] }>(
        '/failed-pickups'
      )
      .then((res) => {
        if (!cancelled) setRows(res.failed_pickups ?? []);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(
            err?.message ||
              t(
                'business.failedPickups.fetchError',
                'Failed to fetch failed pickups'
              )
          );
          enqueueSnackbar(
            t(
              'business.failedPickups.fetchError',
              'Failed to fetch failed pickups'
            ),
            { variant: 'error' }
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.business?.id, apiClient, enqueueSnackbar, t]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={t('business.failedPickups.title', 'Failed pickups')}
        description={t(
          'business.failedPickups.description',
          'Cooked-food pickups marked as failed by your business'
        )}
      />
      <Typography variant="h4" gutterBottom>
        {t('business.failedPickups.title', 'Failed pickups')}
      </Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="info">
          {t('business.failedPickups.empty', 'No failed pickups')}
        </Alert>
      ) : (
        <Stack spacing={2}>
          {rows.map((row) => {
            const reason = isFr
              ? row.failure_reason?.reason_fr
              : row.failure_reason?.reason_en;
            const clientName = [
              row.order?.client?.user?.first_name,
              row.order?.client?.user?.last_name,
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Paper key={row.id} sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {row.order?.order_number ?? row.order_id}
                    </Typography>
                    {clientName ? (
                      <Typography variant="body2" color="text.secondary">
                        {clientName}
                      </Typography>
                    ) : null}
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {reason ?? row.failure_reason?.reason_key}
                    </Typography>
                  </Box>
                  <Stack spacing={0.5} alignItems={{ sm: 'flex-end' }}>
                    <Chip
                      size="small"
                      label={t(
                        'business.failedPickups.refundChip',
                        'Refund {{amount}} {{currency}}',
                        {
                          amount: row.refund_amount,
                          currency: row.currency,
                        }
                      )}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'business.failedPickups.feeRetained',
                        'Fee retained: {{amount}} {{currency}}',
                        {
                          amount: row.fee_retained,
                          currency: row.currency,
                        }
                      )}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Container>
  );
};

export default FailedPickupsPage;
