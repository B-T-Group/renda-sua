import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Badge,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as StoreIcon,
  Warehouse as WarehouseIcon,
  Business as BusinessIcon,
  LocalShipping as PickupIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useBusinessOrders, OrderFilters } from '../../hooks/useBusinessOrders';
import {
  useBusinessInventory,
  AddInventoryItemData,
} from '../../hooks/useBusinessInventory';
import { useInventoryItems } from '../../hooks/useInventoryItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import {
  useBusinessLocations,
  BusinessLocation,
  AddBusinessLocationData,
} from '../../hooks/useBusinessLocations';

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
      id={`business-tabpanel-${index}`}
      aria-labelledby={`business-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfile();

  const [tabValue, setTabValue] = useState(0);
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({});
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItemData, setNewItemData] = useState<Partial<AddInventoryItemData>>(
    {}
  );

  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    fetchOrders,
    updateOrderStatus,
    assignOrderToAgent,
  } = useBusinessOrders();

  const {
    inventory,
    availableItems,
    businessLocations,
    loading: inventoryLoading,
    error: inventoryError,
    fetchInventory,
    fetchAvailableItems,
    fetchBusinessLocations,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    restockItem,
  } = useBusinessInventory();

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    fetchLocations,
    addLocation,
    updateLocation,
    deleteLocation,
  } = useBusinessLocations();

  useEffect(() => {
    fetchOrders();
    fetchInventory();
    fetchAvailableItems();
    fetchBusinessLocations();
    fetchLocations();
  }, [
    fetchOrders,
    fetchInventory,
    fetchAvailableItems,
    fetchBusinessLocations,
    fetchLocations,
  ]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterChange = (filters: Partial<OrderFilters>) => {
    const newFilters = { ...orderFilters, ...filters };
    setOrderFilters(newFilters);
    fetchOrders(newFilters);
  };

  const handleAddItem = async () => {
    if (newItemData.business_location_id && newItemData.item_id) {
      await addInventoryItem(newItemData as AddInventoryItemData);
      setShowAddItemDialog(false);
      setNewItemData({});
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<
      string,
      | 'default'
      | 'primary'
      | 'secondary'
      | 'error'
      | 'info'
      | 'success'
      | 'warning'
    > = {
      pending: 'warning',
      confirmed: 'info',
      preparing: 'info',
      ready_for_pickup: 'primary',
      assigned_to_agent: 'primary',
      picked_up: 'info',
      in_transit: 'info',
      out_for_delivery: 'primary',
      delivered: 'success',
      cancelled: 'error',
      failed: 'error',
      refunded: 'error',
    };
    return statusColors[status] || 'default';
  };

  const formatAddress = (address: any) => {
    return `${address.address_line_1}, ${address.city}, ${address.state} ${address.postal_code}`;
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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('business.dashboard.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('business.dashboard.welcome', {
            name: profile?.first_name || 'Business Owner',
          })}
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="business dashboard tabs"
        >
          <Tab
            label={
              <Badge badgeContent={orders.length} color="primary">
                {t('business.dashboard.orders')}
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={inventory.length} color="secondary">
                {t('business.dashboard.inventory')}
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={locations.length} color="success">
                {t('business.dashboard.locations')}
              </Badge>
            }
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Orders Management */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.orders.title')}
            </Typography>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label={t('business.orders.filters.search')}
                    value={orderFilters.search || ''}
                    onChange={(e) =>
                      handleFilterChange({ search: e.target.value })
                    }
                    InputProps={{
                      startAdornment: (
                        <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>
                      {t('business.orders.filters.status')}
                    </InputLabel>
                    <Select
                      value={orderFilters.status || 'all'}
                      onChange={(e) =>
                        handleFilterChange({ status: e.target.value })
                      }
                      label={t('business.orders.filters.status')}
                    >
                      <MenuItem value="all">
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
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label={t('business.orders.filters.dateFrom')}
                    value={orderFilters.dateFrom || ''}
                    onChange={(e) =>
                      handleFilterChange({ dateFrom: e.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label={t('business.orders.filters.dateTo')}
                    value={orderFilters.dateTo || ''}
                    onChange={(e) =>
                      handleFilterChange({ dateTo: e.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label={t('business.orders.filters.address')}
                    value={orderFilters.address || ''}
                    onChange={(e) =>
                      handleFilterChange({ address: e.target.value })
                    }
                    InputProps={{
                      startAdornment: (
                        <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Orders List */}
            {ordersLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : ordersError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {ordersError}
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {t('business.orders.table.orderNumber')}
                      </TableCell>
                      <TableCell>
                        {t('business.orders.table.customer')}
                      </TableCell>
                      <TableCell>{t('business.orders.table.items')}</TableCell>
                      <TableCell>{t('business.orders.table.total')}</TableCell>
                      <TableCell>{t('business.orders.table.status')}</TableCell>
                      <TableCell>
                        {t('business.orders.table.deliveryAddress')}
                      </TableCell>
                      <TableCell>{t('business.orders.table.agent')}</TableCell>
                      <TableCell>
                        {t('business.orders.table.createdAt')}
                      </TableCell>
                      <TableCell>
                        {t('business.orders.table.actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {order.order_number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {order.client.user.first_name}{' '}
                              {order.client.user.last_name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {order.client.user.email}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {order.order_items.length}{' '}
                            {t('business.orders.table.item', {
                              count: order.order_items.length,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(order.total_amount, order.currency)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={t(
                              `business.orders.status.${order.current_status}`
                            )}
                            color={getStatusColor(order.current_status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ maxWidth: 200 }}
                          >
                            {formatAddress(order.delivery_address)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {order.assigned_agent ? (
                            <Typography variant="body2">
                              {order.assigned_agent.user.first_name}{' '}
                              {order.assigned_agent.user.last_name}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {t('business.orders.table.unassigned')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(order.created_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            {order.current_status === 'pending' && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  updateOrderStatus(order.id, 'confirmed')
                                }
                              >
                                {t('business.orders.actions.confirm')}
                              </Button>
                            )}
                            {order.current_status === 'confirmed' && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  updateOrderStatus(order.id, 'preparing')
                                }
                              >
                                {t('business.orders.actions.prepare')}
                              </Button>
                            )}
                            {order.current_status === 'preparing' && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  updateOrderStatus(
                                    order.id,
                                    'ready_for_pickup'
                                  )
                                }
                              >
                                {t('business.orders.actions.ready')}
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Inventory Management */}
          <Box sx={{ mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {t('business.inventory.title')}
              </Typography>
              <Tooltip title={t('business.inventory.noLocationsError')}>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (businessLocations.length === 0) {
                        enqueueSnackbar(
                          t('business.inventory.noLocationsError'),
                          {
                            variant: 'error',
                          }
                        );
                        return;
                      }
                      setShowAddItemDialog(true);
                    }}
                    disabled={businessLocations.length === 0}
                  >
                    {t('business.inventory.addItem')}
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {inventoryLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : inventoryError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {inventoryError}
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {inventory.map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {item.item.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          gutterBottom
                        >
                          {item.item.description}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('business.inventory.quantity')}
                              </Typography>
                              <Typography variant="body2">
                                {item.quantity}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('business.inventory.available')}
                              </Typography>
                              <Typography variant="body2">
                                {item.available_quantity}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('business.inventory.sellingPrice')}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {formatCurrency(
                                  item.selling_price,
                                  item.item.currency
                                )}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('business.inventory.location')}
                              </Typography>
                              <Typography variant="body2">
                                {item.business_location.name}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                        <Box sx={{ mt: 2 }}>
                          <Chip
                            label={
                              item.is_active
                                ? t('business.inventory.active')
                                : t('business.inventory.inactive')
                            }
                            color={item.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button
                          size="small"
                          onClick={() => restockItem(item.id, 10)}
                        >
                          {t('business.inventory.restock')}
                        </Button>
                        <IconButton size="small">
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* Locations Management */}
          <Box sx={{ mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {t('business.locations.title')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  // TODO: Add location dialog logic
                  setShowAddItemDialog(true);
                }}
              >
                {t('business.locations.addLocation')}
              </Button>
            </Box>

            {locationsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : locationsError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {locationsError}
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {locations.map((location) => (
                  <Grid item xs={12} sm={6} md={4} key={location.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {location.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          gutterBottom
                        >
                          {formatAddress(location.address)}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Chip
                            label={
                              location.is_active
                                ? t('business.locations.active')
                                : t('business.locations.inactive')
                            }
                            color={location.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button
                          size="small"
                          onClick={() =>
                            updateLocation(location.id, {
                              is_active: !location.is_active,
                            })
                          }
                        >
                          {location.is_active
                            ? t('business.locations.deactivate')
                            : t('business.locations.activate')}
                        </Button>
                        <IconButton size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Add Item Dialog */}
      <Dialog
        open={showAddItemDialog}
        onClose={() => setShowAddItemDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('business.inventory.addItem')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.location')}</InputLabel>
                <Select
                  value={newItemData.business_location_id || ''}
                  onChange={(e) =>
                    setNewItemData({
                      ...newItemData,
                      business_location_id: e.target.value,
                    })
                  }
                  label={t('business.inventory.location')}
                >
                  {businessLocations.map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.name} - {formatAddress(location.address)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.item')}</InputLabel>
                <Select
                  value={newItemData.item_id || ''}
                  onChange={(e) =>
                    setNewItemData({ ...newItemData, item_id: e.target.value })
                  }
                  label={t('business.inventory.item')}
                >
                  {availableItems.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name} - {formatCurrency(item.price, item.currency)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('business.inventory.quantity')}
                value={newItemData.quantity || ''}
                onChange={(e) =>
                  setNewItemData({
                    ...newItemData,
                    quantity: parseInt(e.target.value) || 0,
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('business.inventory.sellingPrice')}
                value={newItemData.selling_price || ''}
                onChange={(e) =>
                  setNewItemData({
                    ...newItemData,
                    selling_price: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('business.inventory.unitCost')}
                value={newItemData.unit_cost || ''}
                onChange={(e) =>
                  setNewItemData({
                    ...newItemData,
                    unit_cost: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('business.inventory.reorderPoint')}
                value={newItemData.reorder_point || ''}
                onChange={(e) =>
                  setNewItemData({
                    ...newItemData,
                    reorder_point: parseInt(e.target.value) || 0,
                  })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddItemDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAddItem} variant="contained">
            {t('business.inventory.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BusinessDashboard;
