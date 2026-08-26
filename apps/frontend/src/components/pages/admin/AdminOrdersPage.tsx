import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { OrderRiskChip } from '../../admin/orders/OrderRiskChip';
import {
  formatAbsoluteTime,
  formatMinutes,
  formatOrderAmount,
  formatTimeAgo,
  nextActionLabel,
  riskTypeLabel,
  statusColor,
} from '../../admin/orders/orderRiskLabels';
import {
  useAdminOrders,
  type AdminOrderRow,
} from '../../../hooks/useAdminOrders';

const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'in_delivery',
];

const RISK_TYPE_OPTIONS = [
  'pending_acceptance',
  'prep_overdue',
  'ready_unassigned',
  'pickup_uncollected',
  'pickup_overdue',
  'delivery_delayed',
] as const;

export const AdminOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<'at_risk' | 'all'>('at_risk');
  const [status, setStatus] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [riskType, setRiskType] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const filters = useMemo(
    () => ({
      queue,
      status,
      severity,
      risk_type: riskType === 'all' ? undefined : riskType,
      search: search.trim() || undefined,
      offset: page * rowsPerPage,
      limit: rowsPerPage,
    }),
    [queue, status, severity, riskType, search, page, rowsPerPage]
  );

  const { data, isLoading, error, refetch } = useAdminOrders(filters);

  const resetToFirstPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4">
            {t('admin.orders.title', 'Order operations')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'admin.orders.subtitle',
              'Orders that need a human, and everything else still in flight.'
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            onClick={() => navigate('/admin/pickup-ops')}
          >
            {t('admin.orders.pickupOps', 'Pickup health')}
          </Button>
          <Tooltip title={t('common.refresh', 'Refresh')}>
            <IconButton onClick={refetch}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={queue}
                onChange={(_e, value) =>
                  value && resetToFirstPage(setQueue)(value)
                }
              >
                <ToggleButton value="at_risk">
                  {t('admin.orders.queueAtRisk', 'Needs attention')}
                  {data ? ` (${data.counts.at_risk})` : ''}
                </ToggleButton>
                <ToggleButton value="all">
                  {t('admin.orders.queueAll', 'All active orders')}
                  {data ? ` (${data.counts.total})` : ''}
                </ToggleButton>
              </ToggleButtonGroup>

              {data && (
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    color="error"
                    label={t('admin.orders.criticalCount', '{{count}} critical', {
                      count: data.counts.critical,
                    })}
                  />
                  <Chip
                    size="small"
                    color="warning"
                    label={t('admin.orders.warningCount', '{{count}} warning', {
                      count: data.counts.warning,
                    })}
                  />
                </Stack>
              )}
            </Stack>

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <TextField
                label={t('admin.orders.search', 'Search')}
                size="small"
                value={search}
                onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
                placeholder={t(
                  'admin.orders.searchPlaceholder',
                  'Order number, client, or business'
                )}
                sx={{ minWidth: 260 }}
              />

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{t('admin.orders.status', 'Status')}</InputLabel>
                <Select
                  value={status}
                  label={t('admin.orders.status', 'Status')}
                  onChange={(e) => resetToFirstPage(setStatus)(e.target.value)}
                >
                  <MenuItem value="all">
                    {t('admin.orders.allStatuses', 'All statuses')}
                  </MenuItem>
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t('admin.orders.severity', 'Severity')}</InputLabel>
                <Select
                  value={severity}
                  label={t('admin.orders.severity', 'Severity')}
                  onChange={(e) => resetToFirstPage(setSeverity)(e.target.value)}
                >
                  <MenuItem value="all">
                    {t('admin.orders.allSeverities', 'All severities')}
                  </MenuItem>
                  <MenuItem value="critical">
                    {t('admin.orders.riskLabels.critical', 'Critical')}
                  </MenuItem>
                  <MenuItem value="warning">
                    {t('admin.orders.riskLabels.warning', 'Warning')}
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>{t('admin.orders.riskType', 'Risk')}</InputLabel>
                <Select
                  value={riskType}
                  label={t('admin.orders.riskType', 'Risk')}
                  onChange={(e) => resetToFirstPage(setRiskType)(e.target.value)}
                >
                  <MenuItem value="all">
                    {t('admin.orders.allRisks', 'All risks')}
                  </MenuItem>
                  {RISK_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {riskTypeLabel(t, option)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={
          <Button color="inherit" size="small" onClick={refetch}>
            {t('common.retry', 'Retry')}
          </Button>
        }>
          {t('admin.orders.error', 'Failed to load orders')}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.orders.risk', 'Risk')}</TableCell>
                  <TableCell>{t('admin.orders.orderNumber', 'Order #')}</TableCell>
                  <TableCell>{t('admin.orders.whyAtRisk', 'Why')}</TableCell>
                  <TableCell>{t('admin.orders.statusHeader', 'Status')}</TableCell>
                  <TableCell>{t('admin.orders.business', 'Business')}</TableCell>
                  <TableCell>{t('admin.orders.agent', 'Agent')}</TableCell>
                  <TableCell>{t('admin.orders.amount', 'Amount')}</TableCell>
                  <TableCell>
                    {t('admin.orders.lastUpdated', 'Last updated')}
                  </TableCell>
                  <TableCell align="right">
                    {t('admin.orders.actions', 'Actions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.orders.map((order) => (
                  <OrderQueueRow key={order.id} order={order} />
                ))}
                {data?.orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 4 }}
                      >
                        {queue === 'at_risk'
                          ? t(
                              'admin.orders.emptyAtRisk',
                              'Nothing needs attention right now.'
                            )
                          : t('admin.orders.noOrders', 'No orders found')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={data?.total || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>
      )}
    </Box>
  );
};

const OrderQueueRow: React.FC<{ order: AdminOrderRow }> = ({ order }) => {
  const { t } = useTranslation();
  const leading = order.risk_incidents[0];
  const recommendation = nextActionLabel(t, order.next_action);
  const business =
    order.business_location?.name ||
    order.contacts.find((c) => c.role === 'business')?.name ||
    '—';
  const agent = order.contacts.find((c) => c.role === 'agent')?.name;

  return (
    <TableRow hover>
      <TableCell>
        <Stack spacing={0.5} alignItems="flex-start">
          <OrderRiskChip level={order.risk_level} tooltip={order.risk_summary} />
          {order.risk_acknowledged && order.risk_level !== 'none' && (
            <Chip
              size="small"
              variant="outlined"
              label={t('admin.orders.acknowledgedShort', 'Acknowledged')}
            />
          )}
        </Stack>
      </TableCell>
      <TableCell>{order.order_number}</TableCell>
      <TableCell sx={{ maxWidth: 320 }}>
        {leading ? (
          <>
            <Typography variant="body2" fontWeight={600}>
              {riskTypeLabel(t, leading.risk_type)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('admin.orders.overdueBy', 'overdue by {{duration}}', {
                duration: formatMinutes(t, leading.overdue_minutes),
              })}
              {recommendation ? ` · ${recommendation}` : ''}
            </Typography>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t('admin.orders.onTrack', 'On track')}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          label={order.current_status.replace(/_/g, ' ')}
          color={statusColor(order.current_status)}
        />
      </TableCell>
      <TableCell>{business}</TableCell>
      <TableCell>
        {agent || t('admin.orders.noAgent', 'Unassigned')}
      </TableCell>
      <TableCell>
        {formatOrderAmount(order.total_amount, order.currency)}
      </TableCell>
      <TableCell>
        <Tooltip title={formatAbsoluteTime(order.timing.updated_at)}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {formatTimeAgo(t, order.timing.updated_at)}
          </Typography>
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Button
          size="small"
          endIcon={<LaunchIcon />}
          component="a"
          href={`/admin/orders/${order.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('admin.orders.openOrder', 'Open order')}
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default AdminOrdersPage;
