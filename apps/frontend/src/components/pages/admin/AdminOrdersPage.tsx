import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAdminOrders, OrderWithRisk } from '../../../hooks/useAdminOrders';
import { OrderDetailDialog } from '../../admin/orders/OrderDetailDialog';

const getRiskColor = (level: string) => {
  switch (level) {
    case 'critical':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

const getRiskIcon = (level: string) => {
  switch (level) {
    case 'critical':
      return <ErrorIcon fontSize="small" />;
    case 'high':
      return <WarningIcon fontSize="small" />;
    case 'medium':
      return <InfoIcon fontSize="small" />;
    case 'low':
      return <CheckCircleIcon fontSize="small" />;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  if (status.includes('cancel') || status.includes('fail')) return 'error';
  if (status === 'delivered' || status === 'complete') return 'success';
  if (status === 'pending' || status === 'pending_payment') return 'warning';
  return 'primary';
};

export const AdminOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRisk | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useAdminOrders({
    status: statusFilter,
    risk_level: riskFilter,
    search: searchQuery,
    offset: page * rowsPerPage,
    limit: rowsPerPage,
  });

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewOrder = (order: OrderWithRisk) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedOrder(null);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'XAF',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('admin.orders.title', 'Order Risk Management')}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label={t('admin.orders.search', 'Search')}
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.orders.searchPlaceholder', 'Order number or client name')}
              sx={{ minWidth: 250 }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('admin.orders.status', 'Status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('admin.orders.status', 'Status')}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">{t('admin.orders.allStatuses', 'All Statuses')}</MenuItem>
                <MenuItem value="pending">{t('admin.orders.pending', 'Pending')}</MenuItem>
                <MenuItem value="confirmed">{t('admin.orders.confirmed', 'Confirmed')}</MenuItem>
                <MenuItem value="preparing">{t('admin.orders.preparing', 'Preparing')}</MenuItem>
                <MenuItem value="ready_for_pickup">{t('admin.orders.readyForPickup', 'Ready for Pickup')}</MenuItem>
                <MenuItem value="assigned_to_agent">{t('admin.orders.assignedToAgent', 'Assigned to Agent')}</MenuItem>
                <MenuItem value="picked_up">{t('admin.orders.pickedUp', 'Picked Up')}</MenuItem>
                <MenuItem value="in_transit">{t('admin.orders.inTransit', 'In Transit')}</MenuItem>
                <MenuItem value="out_for_delivery">{t('admin.orders.outForDelivery', 'Out for Delivery')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('admin.orders.riskLevel', 'Risk Level')}</InputLabel>
              <Select
                value={riskFilter}
                label={t('admin.orders.riskLevel', 'Risk Level')}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <MenuItem value="all">{t('admin.orders.allRisks', 'All Risks')}</MenuItem>
                <MenuItem value="critical">{t('admin.orders.critical', 'Critical')}</MenuItem>
                <MenuItem value="high">{t('admin.orders.high', 'High')}</MenuItem>
                <MenuItem value="medium">{t('admin.orders.medium', 'Medium')}</MenuItem>
                <MenuItem value="low">{t('admin.orders.low', 'Low')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
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
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.orders.risk', 'Risk')}</TableCell>
                  <TableCell>{t('admin.orders.orderNumber', 'Order #')}</TableCell>
                  <TableCell>{t('admin.orders.client', 'Client')}</TableCell>
                  <TableCell>{t('admin.orders.business', 'Business')}</TableCell>
                  <TableCell>{t('admin.orders.statusHeader', 'Status')}</TableCell>
                  <TableCell>{t('admin.orders.amount', 'Amount')}</TableCell>
                  <TableCell>{t('admin.orders.created', 'Created')}</TableCell>
                  <TableCell>{t('admin.orders.agent', 'Agent')}</TableCell>
                  <TableCell>{t('admin.orders.actions', 'Actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.orders.map((order) => (
                  <TableRow
                    key={order.id}
                    sx={{
                      backgroundColor:
                        order.risk_level === 'critical'
                          ? 'rgba(211, 47, 47, 0.08)'
                          : order.risk_level === 'high'
                          ? 'rgba(237, 108, 2, 0.08)'
                          : 'inherit',
                    }}
                  >
                    <TableCell>
                      <Tooltip
                        title={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                              {t('admin.orders.riskFactors', 'Risk Factors')}:
                            </Typography>
                            {order.risk_factors.length > 0 ? (
                              order.risk_factors.map((factor, idx) => (
                                <Typography key={idx} variant="body2">
                                  • {factor}
                                </Typography>
                              ))
                            ) : (
                              <Typography variant="body2">
                                {t('admin.orders.noRiskFactors', 'No risk factors')}
                              </Typography>
                            )}
                          </Box>
                        }
                      >
                        <Chip
                          icon={getRiskIcon(order.risk_level)}
                          label={`${order.risk_score} - ${order.risk_level.toUpperCase()}`}
                          color={getRiskColor(order.risk_level) as any}
                          size="small"
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>{order.order_number}</TableCell>
                    <TableCell>
                      {order.client?.user
                        ? `${order.client.user.first_name} ${order.client.user.last_name}`
                        : t('admin.orders.noClient', 'N/A')}
                    </TableCell>
                    <TableCell>
                      {order.business_location?.location_name || order.business?.business_name || t('admin.orders.noBusiness', 'N/A')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.current_status.replace(/_/g, ' ')}
                        color={getStatusColor(order.current_status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(order.total_amount, order.currency)}</TableCell>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                    <TableCell>
                      {order.assigned_agent?.user
                        ? `${order.assigned_agent.user.first_name} ${order.assigned_agent.user.last_name}`
                        : t('admin.orders.noAgent', 'Unassigned')}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={t('admin.orders.viewDetails', 'View Details')}>
                        <IconButton size="small" onClick={() => handleViewOrder(order)}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        {t('admin.orders.noOrders', 'No orders found')}
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
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}

      {selectedOrder && (
        <OrderDetailDialog
          open={detailDialogOpen}
          order={selectedOrder}
          onClose={handleCloseDetailDialog}
        />
      )}
    </Box>
  );
};
