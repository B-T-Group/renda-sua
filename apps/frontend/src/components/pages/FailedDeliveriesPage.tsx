import {
  CheckCircle,
  Error as ErrorIcon,
  FilterList,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  FailedDelivery,
  GetFailedDeliveriesFilters,
  useFailedDeliveries,
} from '../../hooks/useFailedDeliveries';
import ResolveFailedDeliveryDialog from '../dialogs/ResolveFailedDeliveryDialog';
import SEOHead from '../seo/SEOHead';

const FailedDeliveriesPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const {
    loading,
    error,
    getFailedDeliveries,
    resolveFailedDelivery,
  } = useFailedDeliveries();

  const [failedDeliveries, setFailedDeliveries] = useState<FailedDelivery[]>(
    []
  );
  const [filters, setFilters] = useState<GetFailedDeliveriesFilters>({});
  const [resolvingOrderId, setResolvingOrderId] = useState<string | null>(
    null
  );

  const fetchFailedDeliveries = async () => {
    try {
      const deliveries = await getFailedDeliveries(filters);
      setFailedDeliveries(deliveries);
    } catch (err: any) {
      console.error('Error fetching failed deliveries:', err);
      enqueueSnackbar(
        t(
          'business.failedDeliveries.fetchError',
          'Failed to fetch failed deliveries'
        ),
        { variant: 'error' }
      );
    }
  };

  useEffect(() => {
    if (profile?.business?.id) {
      fetchFailedDeliveries();
    }
  }, [profile?.business?.id, filters]);

  const handleResolve = async (
    orderId: string,
    resolution: {
      resolution_type: 'agent_fault' | 'client_fault' | 'item_fault';
      outcome: string;
      restore_inventory?: boolean;
    }
  ) => {
    try {
      await resolveFailedDelivery(orderId, resolution);
      enqueueSnackbar(
        t(
          'business.failedDeliveries.resolveSuccess',
          'Failed delivery resolved successfully'
        ),
        { variant: 'success' }
      );
      setResolvingOrderId(null);
      fetchFailedDeliveries();
    } catch (err: any) {
      console.error('Error resolving failed delivery:', err);
      enqueueSnackbar(
        t(
          'business.failedDeliveries.resolveError',
          'Failed to resolve delivery'
        ),
        { variant: 'error' }
      );
    }
  };

  const pendingDeliveries = failedDeliveries.filter(
    (fd) => fd.status === 'pending'
  );
  const completedDeliveries = failedDeliveries.filter(
    (fd) => fd.status === 'completed'
  );

  const getResolutionTypeColor = (
    type?: 'agent_fault' | 'client_fault' | 'item_fault'
  ) => {
    switch (type) {
      case 'agent_fault':
        return 'error';
      case 'client_fault':
        return 'warning';
      case 'item_fault':
        return 'info';
      default:
        return 'default';
    }
  };

  const getResolutionTypeLabel = (
    type?: 'agent_fault' | 'client_fault' | 'item_fault'
  ) => {
    if (!type) return '';
    return t(
      `business.failedDeliveries.resolutionType.${type}`,
      type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  return (
    <>
      <SEOHead
        title={t(
          'business.failedDeliveries.pageTitle',
          'Failed Deliveries Management'
        )}
      />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              {t('business.failedDeliveries.title', 'Failed Deliveries')}
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchFailedDeliveries}
              disabled={loading}
              variant="outlined"
            >
              {t('common.refresh', 'Refresh')}
            </Button>
          </Stack>
          <Typography variant="body1" color="text.secondary">
            {t(
              'business.failedDeliveries.description',
              'Manage and resolve failed deliveries for your business'
            )}
          </Typography>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            alignItems={isMobile ? 'stretch' : 'center'}
          >
            <FilterList sx={{ color: 'text.secondary' }} />
            <FormControl fullWidth={isMobile} sx={{ minWidth: 200 }}>
              <InputLabel>
                {t('business.failedDeliveries.filterStatus', 'Status')}
              </InputLabel>
              <Select
                value={filters.status || 'all'}
                label={t('business.failedDeliveries.filterStatus', 'Status')}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters({
                    ...filters,
                    status:
                      value === 'all'
                        ? undefined
                        : (value as 'pending' | 'completed'),
                  });
                }}
              >
                <MenuItem value="all">
                  {t('common.all', 'All')}
                </MenuItem>
                <MenuItem value="pending">
                  {t('business.failedDeliveries.status.pending', 'Pending')}
                </MenuItem>
                <MenuItem value="completed">
                  {t(
                    'business.failedDeliveries.status.completed',
                    'Completed'
                  )}
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth={isMobile} sx={{ minWidth: 200 }}>
              <InputLabel>
                {t(
                  'business.failedDeliveries.filterResolutionType',
                  'Resolution Type'
                )}
              </InputLabel>
              <Select
                value={filters.resolution_type || 'all'}
                label={t(
                  'business.failedDeliveries.filterResolutionType',
                  'Resolution Type'
                )}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters({
                    ...filters,
                    resolution_type:
                      value === 'all'
                        ? undefined
                        : (value as
                            | 'agent_fault'
                            | 'client_fault'
                            | 'item_fault'),
                  });
                }}
              >
                <MenuItem value="all">
                  {t('common.all', 'All')}
                </MenuItem>
                <MenuItem value="agent_fault">
                  {t(
                    'business.failedDeliveries.resolutionType.agent_fault',
                    'Agent Fault'
                  )}
                </MenuItem>
                <MenuItem value="client_fault">
                  {t(
                    'business.failedDeliveries.resolutionType.client_fault',
                    'Client Fault'
                  )}
                </MenuItem>
                <MenuItem value="item_fault">
                  {t(
                    'business.failedDeliveries.resolutionType.item_fault',
                    'Item Fault'
                  )}
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && failedDeliveries.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Pending Deliveries */}
        {!loading && pendingDeliveries.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              {t('business.failedDeliveries.pending', 'Pending Resolutions')}
              <Chip
                label={pendingDeliveries.length}
                color="error"
                size="small"
                sx={{ ml: 1 }}
              />
            </Typography>
            <Grid container spacing={2}>
              {pendingDeliveries.map((failedDelivery) => (
                <Grid item xs={12} key={failedDelivery.id}>
                  <Card>
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Box>
                            <Typography variant="h6" gutterBottom>
                              {t(
                                'business.failedDeliveries.orderNumber',
                                'Order #{{orderNumber}}',
                                {
                                  orderNumber: failedDelivery.order.order_number,
                                }
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t(
                                'business.failedDeliveries.failureReason',
                                'Failure Reason: {{reason}}',
                                {
                                  reason:
                                    failedDelivery.failure_reason.reason_fr ||
                                    failedDelivery.failure_reason.reason_en,
                                }
                              )}
                            </Typography>
                            {failedDelivery.notes && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1 }}
                              >
                                {t('business.failedDeliveries.notes', 'Notes')}:{' '}
                                {failedDelivery.notes}
                              </Typography>
                            )}
                          </Box>
                          <Chip
                            label={t(
                              'business.failedDeliveries.status.pending',
                              'Pending'
                            )}
                            color="error"
                            icon={<ErrorIcon />}
                          />
                        </Stack>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t(
                              'business.failedDeliveries.client',
                              'Client'
                            )}:{' '}
                            {failedDelivery.order.client.user.first_name}{' '}
                            {failedDelivery.order.client.user.last_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('business.failedDeliveries.amount', 'Amount')}:{' '}
                            {failedDelivery.order.total_amount.toFixed(2)}{' '}
                            {failedDelivery.order.currency}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t(
                              'business.failedDeliveries.createdAt',
                              'Failed On'
                            )}:{' '}
                            {new Date(
                              failedDelivery.created_at
                            ).toLocaleString()}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() =>
                            setResolvingOrderId(failedDelivery.order_id)
                          }
                          fullWidth={isMobile}
                        >
                          {t(
                            'business.failedDeliveries.resolve',
                            'Resolve Failed Delivery'
                          )}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Completed Deliveries */}
        {!loading && completedDeliveries.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              {t(
                'business.failedDeliveries.completed',
                'Resolved Deliveries'
              )}
              <Chip
                label={completedDeliveries.length}
                color="success"
                size="small"
                sx={{ ml: 1 }}
              />
            </Typography>
            <Grid container spacing={2}>
              {completedDeliveries.map((failedDelivery) => (
                <Grid item xs={12} key={failedDelivery.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Box>
                            <Typography variant="h6" gutterBottom>
                              {t(
                                'business.failedDeliveries.orderNumber',
                                'Order #{{orderNumber}}',
                                {
                                  orderNumber: failedDelivery.order.order_number,
                                }
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t(
                                'business.failedDeliveries.failureReason',
                                'Failure Reason: {{reason}}',
                                {
                                  reason:
                                    failedDelivery.failure_reason.reason_fr ||
                                    failedDelivery.failure_reason.reason_en,
                                }
                              )}
                            </Typography>
                            {failedDelivery.resolution_type && (
                              <Chip
                                label={getResolutionTypeLabel(
                                  failedDelivery.resolution_type
                                )}
                                color={
                                  getResolutionTypeColor(
                                    failedDelivery.resolution_type
                                  ) as any
                                }
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            )}
                          </Box>
                          <Chip
                            label={t(
                              'business.failedDeliveries.status.completed',
                              'Completed'
                            )}
                            color="success"
                            icon={<CheckCircle />}
                          />
                        </Stack>
                        {failedDelivery.outcome && (
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {t('business.failedDeliveries.outcome', 'Outcome')}:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {failedDelivery.outcome}
                            </Typography>
                          </Box>
                        )}
                        {failedDelivery.resolved_at && (
                          <Typography variant="body2" color="text.secondary">
                            {t(
                              'business.failedDeliveries.resolvedAt',
                              'Resolved On'
                            )}:{' '}
                            {new Date(
                              failedDelivery.resolved_at
                            ).toLocaleString()}
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Empty State */}
        {!loading &&
          failedDeliveries.length === 0 &&
          !error && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {t(
                  'business.failedDeliveries.noFailedDeliveries',
                  'No failed deliveries found'
                )}
              </Typography>
            </Paper>
          )}
      </Container>

      {/* Resolution Dialog */}
      {resolvingOrderId && (
        <ResolveFailedDeliveryDialog
          open={!!resolvingOrderId}
          orderId={resolvingOrderId}
          onClose={() => setResolvingOrderId(null)}
          onResolve={handleResolve}
        />
      )}
    </>
  );
};

export default FailedDeliveriesPage;

