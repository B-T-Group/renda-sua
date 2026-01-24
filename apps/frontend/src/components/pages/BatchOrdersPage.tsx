import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBatchOrderActions, useOrders, useShippingLabels } from '../../hooks';
import type { Order } from '../../hooks';
import SEOHead from '../seo/SEOHead';

const PRINT_LABELS_STATUSES = [
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'complete',
];

type BatchAction =
  | 'start_preparing'
  | 'complete_preparation'
  | 'print_labels'
  | 'pick_up'
  | 'start_transit'
  | 'out_for_delivery'
  | 'deliver';

interface SelectionState {
  [orderId: string]: boolean;
}

interface PerOrderResult {
  [orderId: string]: {
    success: boolean;
    message: string;
  };
}

const isBusinessAction = (action: BatchAction | '') =>
  action === 'start_preparing' ||
  action === 'complete_preparation' ||
  action === 'print_labels';

const isAgentAction = (action: BatchAction | '') =>
  action === 'pick_up' ||
  action === 'start_transit' ||
  action === 'out_for_delivery' ||
  action === 'deliver';

const getValidStatusesForAction = (action: BatchAction | ''): string[] => {
  if (action === 'start_preparing') return ['confirmed'];
  if (action === 'complete_preparation') return ['preparing'];
  if (action === 'print_labels') return PRINT_LABELS_STATUSES;
  if (action === 'pick_up') return ['assigned_to_agent'];
  if (action === 'start_transit') return ['picked_up'];
  if (action === 'out_for_delivery') return ['picked_up', 'in_transit'];
  if (action === 'deliver') return ['out_for_delivery'];
  return [];
};

const canApplyActionToOrder = (order: Order, action: BatchAction | '') => {
  const allowed = getValidStatusesForAction(action);
  if (!allowed.length) return false;
  return allowed.includes(order.current_status || '');
};

const BatchOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const { orders, loading, error, refreshOrders } = useOrders();
  const {
    batchStartPreparing,
    batchCompletePreparation,
    batchPickUp,
    batchStartTransit,
    batchOutForDelivery,
    batchDeliver,
  } = useBatchOrderActions();
  const { printLabels, loading: printLabelsLoading } = useShippingLabels();

  const [selectedAction, setSelectedAction] = useState<BatchAction | ''>('');
  const [notes, setNotes] = useState('');
  const [selection, setSelection] = useState<SelectionState>({});
  const [results, setResults] = useState<PerOrderResult>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ success: number; failed: number }>();

  const isBusiness = !!profile?.business;
  const isAgent = !!profile?.agent;

  const filteredOrders = useMemo(() => {
    if (!selectedAction) return orders;
    return orders.filter((order) =>
      canApplyActionToOrder(order, selectedAction)
    );
  }, [orders, selectedAction]);

  const toggleSelection = (orderId: string) => {
    setSelection((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const isSelected = (orderId: string) => !!selection[orderId];

  const selectAll = () => {
    const next: SelectionState = {};
    filteredOrders.forEach((order) => {
      next[order.id] = true;
    });
    setSelection(next);
  };

  const clearSelection = () => {
    setSelection({});
  };

  const selectedOrderIds = useMemo(
    () => filteredOrders.filter((o) => isSelected(o.id)).map((o) => o.id),
    [filteredOrders, selection]
  );

  const handleActionChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const value = event.target.value as BatchAction | '';
    setSelectedAction(value);
    setSelection({});
    setResults({});
    setSummary(undefined);
    setActionError(null);
  };

  const applyBatchAction = async () => {
    if (!selectedAction || !selectedOrderIds.length) return;

    setActionError(null);
    setResults({});
    setSummary(undefined);

    if (selectedAction === 'print_labels') {
      try {
        await printLabels(selectedOrderIds);
        setSummary({
          success: selectedOrderIds.length,
          failed: 0,
        });
      } catch (err: any) {
        setActionError(
          err?.message ||
            t(
              'orders.shippingLabel.printError',
              'Could not generate shipping labels.'
            )
        );
      }
      return;
    }

    try {
      let response;

      if (selectedAction === 'start_preparing') {
        response = await batchStartPreparing(selectedOrderIds, notes);
      } else if (selectedAction === 'complete_preparation') {
        response = await batchCompletePreparation(selectedOrderIds, notes);
      } else if (selectedAction === 'pick_up') {
        response = await batchPickUp(selectedOrderIds, notes);
      } else if (selectedAction === 'start_transit') {
        response = await batchStartTransit(selectedOrderIds, notes);
      } else if (selectedAction === 'out_for_delivery') {
        response = await batchOutForDelivery(selectedOrderIds, notes);
      } else if (selectedAction === 'deliver') {
        response = await batchDeliver(selectedOrderIds, notes);
      } else {
        return;
      }

      const perOrder: PerOrderResult = {};
      let successCount = 0;
      let failedCount = 0;

      response.results.forEach((item) => {
        perOrder[item.orderId] = {
          success: item.success,
          message: item.message,
        };
        if (item.success) successCount += 1;
        else failedCount += 1;
      });

      setResults(perOrder);
      setSummary({ success: successCount, failed: failedCount });

      await refreshOrders();

      if (successCount > 0) {
        setSelection({});
      }
    } catch (err: any) {
      setActionError(
        err?.message ||
          t(
            'orders.batch.genericError',
            'Failed to apply batch action. Please try again.'
          )
      );
    }
  };

  const getPageTitle = () => {
    if (isBusiness) {
      return t(
        'orders.batch.businessTitle',
        'Batch process business orders'
      );
    }
    if (isAgent) {
      return t('orders.batch.agentTitle', 'Batch process delivery orders');
    }
    return t('orders.batch.title', 'Batch process orders');
  };

  const getPageSubtitle = () => {
    if (isBusiness) {
      return t(
        'orders.batch.businessSubtitle',
        'Select multiple orders to update their preparation status at once.'
      );
    }
    if (isAgent) {
      return t(
        'orders.batch.agentSubtitle',
        'Select multiple orders to update their delivery status at once.'
      );
    }
    return t(
      'orders.batch.subtitle',
      'Batch processing is available for business and agent users.'
    );
  };

  if (!isBusiness && !isAgent) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <SEOHead title={getPageTitle()} description={getPageSubtitle()} />
        <Alert severity="info">
          {t(
            'orders.batch.notSupported',
            'Batch processing is only available for business and agent accounts.'
          )}
        </Alert>
      </Container>
    );
  }

  const availableActions: Array<{ value: BatchAction; label: string }> = [];

  if (isBusiness) {
    availableActions.push(
      {
        value: 'start_preparing',
        label: t(
          'orders.batch.actions.startPreparing',
          'Start preparing (confirmed → preparing)'
        ),
      },
      {
        value: 'complete_preparation',
        label: t(
          'orders.batch.actions.completePreparation',
          'Complete preparation (preparing → ready for pickup)'
        ),
      },
      {
        value: 'print_labels',
        label: t('orders.batch.actions.printLabels', 'Print labels'),
      }
    );
  }

  if (isAgent) {
    availableActions.push(
      {
        value: 'pick_up',
        label: t(
          'orders.batch.actions.pickUp',
          'Pick up (assigned → picked up)'
        ),
      },
      {
        value: 'start_transit',
        label: t(
          'orders.batch.actions.startTransit',
          'Start transit (picked up → in transit)'
        ),
      },
      {
        value: 'out_for_delivery',
        label: t(
          'orders.batch.actions.outForDelivery',
          'Out for delivery (picked up / in transit → out for delivery)'
        ),
      },
      {
        value: 'deliver',
        label: t(
          'orders.batch.actions.deliver',
          'Deliver (out for delivery → delivered)'
        ),
      }
    );
  }

  const pageTitle = getPageTitle();
  const pageSubtitle = getPageSubtitle();

  return (
    <>
      <SEOHead title={pageTitle} description={pageSubtitle} />
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            fontWeight="bold"
          >
            {pageTitle}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {pageSubtitle}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {typeof error === 'string'
              ? error
              : (error as any)?.message ||
                t('orders.batch.loadError', 'Failed to load orders.')}
          </Alert>
        )}

        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FormControl
              size="small"
              sx={{ minWidth: 260 }}
              disabled={loading || !orders.length}
            >
              <InputLabel>
                {t('orders.batch.selectAction', 'Select batch action')}
              </InputLabel>
              <Select
                value={selectedAction}
                label={t('orders.batch.selectAction', 'Select batch action')}
                onChange={handleActionChange}
              >
                {availableActions.map((action) => (
                  <MenuItem key={action.value} value={action.value}>
                    {action.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedAction !== 'print_labels' && (
              <TextField
                size="small"
                label={t('orders.notes', 'Notes')}
                placeholder={t(
                  'orders.notesPlaceholder',
                  'Add any additional notes about this status change...'
                )}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
              />
            )}

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="flex-end"
              sx={{ flexGrow: 1 }}
            >
              <Button
                variant="outlined"
                onClick={selectAll}
                disabled={loading || !filteredOrders.length}
              >
                {t('orders.batch.selectAll', 'Select all')}
              </Button>
              <Button
                variant="text"
                onClick={clearSelection}
                disabled={loading || !Object.keys(selection).length}
              >
                {t('orders.batch.clearSelection', 'Clear selection')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={applyBatchAction}
                disabled={
                  loading ||
                  (selectedAction === 'print_labels' && printLabelsLoading) ||
                  !selectedAction ||
                  !selectedOrderIds.length
                }
              >
                {selectedAction === 'print_labels' && printLabelsLoading
                  ? t('orders.shippingLabel.generating', 'Generating labels…')
                  : t('orders.batch.applyToSelected', 'Apply to selected')}
              </Button>
            </Stack>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'orders.batch.selectionSummary',
                '{{selected}} of {{total}} orders selected for this action.',
                {
                  selected: selectedOrderIds.length,
                  total: filteredOrders.length,
                }
              )}
            </Typography>
          </Box>
        </Paper>

        {actionError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {actionError}
          </Alert>
        )}

        {summary && (
          <Alert
            severity={summary.failed ? 'warning' : 'success'}
            sx={{ mb: 3 }}
          >
            {t(
              'orders.batch.summary',
              '{{success}} orders updated successfully, {{failed}} failed.',
              {
                success: summary.success,
                failed: summary.failed,
              }
            )}
          </Alert>
        )}

        <Paper sx={{ p: 2 }}>
          {loading ? (
            <Typography>
              {t('orders.batch.loading', 'Loading orders for batch processing…')}
            </Typography>
          ) : !filteredOrders.length ? (
            <Typography color="text.secondary">
              {t(
                'orders.batch.noOrders',
                'No orders are currently eligible for the selected action.'
              )}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {filteredOrders.map((order) => {
                const orderResult = results[order.id];
                const statusLabel = t(
                  `common.orderStatus.${order.current_status}`,
                  order.current_status || 'Unknown'
                );

                return (
                  <Paper
                    key={order.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Checkbox
                      checked={isSelected(order.id)}
                      onChange={() => toggleSelection(order.id)}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {order.order_number}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'orders.batch.orderSummary',
                          'Status: {{status}} • Created: {{date}}',
                          {
                            status: statusLabel,
                            date: new Date(
                              order.created_at
                            ).toLocaleString(),
                          }
                        )}
                      </Typography>
                    </Box>
                    <Chip
                      label={statusLabel}
                      size="small"
                      color={
                        order.current_status === 'delivered'
                          ? 'success'
                          : 'default'
                      }
                    />
                    {order.requires_fast_delivery && (
                      <Chip
                        size="small"
                        color="warning"
                        label={t(
                          'orders.fastDelivery.title',
                          'Fast Delivery'
                        )}
                      />
                    )}
                    {orderResult && (
                      <Chip
                        size="small"
                        color={orderResult.success ? 'success' : 'error'}
                        label={
                          orderResult.success
                            ? t(
                                'orders.batch.success',
                                'Updated'
                              )
                            : t(
                                'orders.batch.failed',
                                'Failed'
                              )
                        }
                        title={orderResult.message}
                      />
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Container>
    </>
  );
};

export default BatchOrdersPage;


