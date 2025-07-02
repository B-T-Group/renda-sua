import {
  AccessTime as AccessTimeIcon,
  LocalShipping as LocalShippingIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useBusinessOrders } from '../../hooks/useBusinessOrders';
import { useUserProfile } from '../../hooks/useUserProfile';
import SEOHead from '../seo/SEOHead';

interface OrderFilters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  address: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`order-tabpanel-${index}`}
      aria-labelledby={`order-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const BusinessOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfile();
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    address: '',
  });

  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    fetchOrders,
  } = useBusinessOrders();
  const { locations } = useBusinessLocations();

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterChange = (newFilters: Partial<OrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'info';
      case 'preparing':
        return 'primary';
      case 'ready_for_pickup':
        return 'secondary';
      case 'assigned_to_agent':
        return 'info';
      case 'picked_up':
        return 'primary';
      case 'in_transit':
        return 'info';
      case 'out_for_delivery':
        return 'secondary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'failed':
        return 'error';
      case 'refunded':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return '';
    return `${address.street_address}, ${address.city}, ${address.state} ${address.postal_code}`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredOrders = orders.filter((order: any) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        order.order_number.toLowerCase().includes(searchLower) ||
        order.client?.first_name?.toLowerCase().includes(searchLower) ||
        order.client?.last_name?.toLowerCase().includes(searchLower) ||
        order.delivery_address?.street_address
          ?.toLowerCase()
          .includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (filters.status && order.status !== filters.status) return false;

    if (filters.dateFrom) {
      const orderDate = new Date(order.created_at);
      const fromDate = new Date(filters.dateFrom);
      if (orderDate < fromDate) return false;
    }

    if (filters.dateTo) {
      const orderDate = new Date(order.created_at);
      const toDate = new Date(filters.dateTo);
      if (orderDate > toDate) return false;
    }

    if (filters.address) {
      const addressLower = filters.address.toLowerCase();
      const deliveryAddress = formatAddress(
        order.delivery_address
      ).toLowerCase();
      if (!deliveryAddress.includes(addressLower)) return false;
    }

    return true;
  });

  const pendingOrders = filteredOrders.filter(
    (order: any) => order.status === 'pending'
  );
  const activeOrders = filteredOrders.filter((order: any) =>
    [
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'assigned_to_agent',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ].includes(order.status)
  );

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('seo.business-orders.title')}
        description={t('seo.business-orders.description')}
        keywords={t('seo.business-orders.keywords')}
      />

      <Typography variant="h4" gutterBottom>
        {t('business.orders.title')}
      </Typography>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          aria-label="order tabs"
        >
          <Tab label={t('business.dashboard.activeOrders')} />
          <Tab label={t('business.dashboard.pendingOrders')} />
          <Tab label={t('business.orders.allOrders')} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Active Orders */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.dashboard.activeOrders')}
            </Typography>
            {ordersLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : ordersError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {ordersError}
              </Alert>
            ) : activeOrders.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('business.dashboard.noActiveOrders')}
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {activeOrders.map((order: any) => (
                  <Card
                    key={order.id}
                    sx={{
                      width: {
                        xs: '100%',
                        sm: 'calc(50% - 8px)',
                        md: 'calc(33.333% - 12px)',
                      },
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={2}
                      >
                        <Typography variant="h6" component="div">
                          {t('business.orders.table.orderNumber', {
                            number: order.order_number,
                          })}
                        </Typography>
                        <Chip
                          label={t(`business.orders.status.${order.status}`)}
                          color={getStatusColor(order.status) as any}
                          size="small"
                        />
                      </Box>

                      <Box mb={2}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                          {order.client?.first_name} {order.client?.last_name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <ReceiptIcon sx={{ mr: 1, fontSize: 16 }} />
                          {order.order_items?.length || 0}{' '}
                          {t('business.orders.table.items')}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <LocalShippingIcon sx={{ mr: 1, fontSize: 16 }} />
                          {formatAddress(order.delivery_address)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                        >
                          <AccessTimeIcon sx={{ mr: 1, fontSize: 16 }} />
                          {formatDate(order.created_at)}
                        </Typography>
                      </Box>

                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="h6" color="primary">
                          {formatCurrency(order.total_amount, order.currency)}
                        </Typography>
                        {order.agent && (
                          <Chip
                            label={`${order.agent.first_name} ${order.agent.last_name}`}
                            size="small"
                            color="secondary"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Pending Orders */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.dashboard.pendingOrders')}
            </Typography>
            {ordersLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : ordersError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {ordersError}
              </Alert>
            ) : pendingOrders.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('business.dashboard.noPendingOrders')}
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {pendingOrders.map((order: any) => (
                  <Card
                    key={order.id}
                    sx={{
                      width: {
                        xs: '100%',
                        sm: 'calc(50% - 8px)',
                        md: 'calc(33.333% - 12px)',
                      },
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={2}
                      >
                        <Typography variant="h6" component="div">
                          {t('business.orders.table.orderNumber', {
                            number: order.order_number,
                          })}
                        </Typography>
                        <Chip
                          label={t(`business.orders.status.${order.status}`)}
                          color={getStatusColor(order.status) as any}
                          size="small"
                        />
                      </Box>

                      <Box mb={2}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                          {order.client?.first_name} {order.client?.last_name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <ReceiptIcon sx={{ mr: 1, fontSize: 16 }} />
                          {order.order_items?.length || 0}{' '}
                          {t('business.orders.table.items')}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <LocalShippingIcon sx={{ mr: 1, fontSize: 16 }} />
                          {formatAddress(order.delivery_address)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                        >
                          <AccessTimeIcon sx={{ mr: 1, fontSize: 16 }} />
                          {formatDate(order.created_at)}
                        </Typography>
                      </Box>

                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="h6" color="primary">
                          {formatCurrency(order.total_amount, order.currency)}
                        </Typography>
                        <Chip
                          label={t('business.orders.table.unassigned')}
                          size="small"
                          color="default"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* All Orders with Filters */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.orders.allOrders')}
            </Typography>

            {/* Order Filters */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                <TextField
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      sm: '1 1 calc(50% - 8px)',
                      md: '1 1 calc(25% - 12px)',
                    },
                  }}
                  label={t('business.orders.filters.search')}
                  value={filters.search}
                  onChange={(e) =>
                    handleFilterChange({ search: e.target.value })
                  }
                  InputProps={{
                    startAdornment: (
                      <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
                <FormControl
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      sm: '1 1 calc(50% - 8px)',
                      md: '1 1 calc(25% - 12px)',
                    },
                  }}
                >
                  <InputLabel>{t('business.orders.filters.status')}</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) =>
                      handleFilterChange({ status: e.target.value })
                    }
                    label={t('business.orders.filters.status')}
                  >
                    <MenuItem value="">
                      {t('business.orders.filters.allStatuses')}
                    </MenuItem>
                    <MenuItem value="pending">
                      {t('business.orders.status.pending')}
                    </MenuItem>
                    <MenuItem value="confirmed">
                      {t('business.orders.status.confirmed')}
                    </MenuItem>
                    <MenuItem value="preparing">
                      {t('business.orders.status.preparing')}
                    </MenuItem>
                    <MenuItem value="ready_for_pickup">
                      {t('business.orders.status.ready_for_pickup')}
                    </MenuItem>
                    <MenuItem value="assigned_to_agent">
                      {t('business.orders.status.assigned_to_agent')}
                    </MenuItem>
                    <MenuItem value="picked_up">
                      {t('business.orders.status.picked_up')}
                    </MenuItem>
                    <MenuItem value="in_transit">
                      {t('business.orders.status.in_transit')}
                    </MenuItem>
                    <MenuItem value="out_for_delivery">
                      {t('business.orders.status.out_for_delivery')}
                    </MenuItem>
                    <MenuItem value="delivered">
                      {t('business.orders.status.delivered')}
                    </MenuItem>
                    <MenuItem value="cancelled">
                      {t('business.orders.status.cancelled')}
                    </MenuItem>
                    <MenuItem value="failed">
                      {t('business.orders.status.failed')}
                    </MenuItem>
                    <MenuItem value="refunded">
                      {t('business.orders.status.refunded')}
                    </MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      sm: '1 1 calc(50% - 8px)',
                      md: '1 1 calc(25% - 12px)',
                    },
                  }}
                  type="date"
                  label={t('business.orders.filters.dateFrom')}
                  value={filters.dateFrom}
                  onChange={(e) =>
                    handleFilterChange({ dateFrom: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      sm: '1 1 calc(50% - 8px)',
                      md: '1 1 calc(25% - 12px)',
                    },
                  }}
                  type="date"
                  label={t('business.orders.filters.dateTo')}
                  value={filters.dateTo}
                  onChange={(e) =>
                    handleFilterChange({ dateTo: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      sm: '1 1 calc(50% - 8px)',
                      md: '1 1 calc(25% - 12px)',
                    },
                  }}
                  label={t('business.orders.filters.address')}
                  value={filters.address}
                  onChange={(e) =>
                    handleFilterChange({ address: e.target.value })
                  }
                  InputProps={{
                    startAdornment: (
                      <LocalShippingIcon
                        sx={{ mr: 1, color: 'text.secondary' }}
                      />
                    ),
                  }}
                />
              </Box>
            </Paper>

            {ordersLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : ordersError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {ordersError}
              </Alert>
            ) : filteredOrders.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('business.orders.noOrdersFound')}
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {filteredOrders.map((order: any) => (
                  <Card
                    key={order.id}
                    sx={{
                      width: {
                        xs: '100%',
                        sm: 'calc(50% - 8px)',
                        md: 'calc(33.333% - 12px)',
                      },
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={2}
                      >
                        <Typography variant="h6" component="div">
                          {t('business.orders.table.orderNumber', {
                            number: order.order_number,
                          })}
                        </Typography>
                        <Chip
                          label={t(`business.orders.status.${order.status}`)}
                          color={getStatusColor(order.status) as any}
                          size="small"
                        />
                      </Box>

                      <Box mb={2}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                          {order.client?.first_name} {order.client?.last_name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <ReceiptIcon sx={{ mr: 1, fontSize: 16 }} />
                          {order.order_items?.length || 0}{' '}
                          {t('business.orders.table.items')}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                          mb={1}
                        >
                          <LocalShippingIcon sx={{ mr: 1, fontSize: 16 }} />
                          {formatAddress(order.delivery_address)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          display="flex"
                          alignItems="center"
                        >
                          <AccessTimeIcon sx={{ mr: 1, fontSize: 16 }} />
                          {formatDate(order.created_at)}
                        </Typography>
                      </Box>

                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="h6" color="primary">
                          {formatCurrency(order.total_amount, order.currency)}
                        </Typography>
                        {order.agent ? (
                          <Chip
                            label={`${order.agent.first_name} ${order.agent.last_name}`}
                            size="small"
                            color="secondary"
                          />
                        ) : (
                          <Chip
                            label={t('business.orders.table.unassigned')}
                            size="small"
                            color="default"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default BusinessOrdersPage;
