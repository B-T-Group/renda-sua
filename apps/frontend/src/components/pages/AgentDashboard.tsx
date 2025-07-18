import { useAuth0 } from '@auth0/auth0-react';
import {
  Business,
  Cancel,
  CheckCircle,
  DirectionsCar,
  History,
  LocalShipping,
  LocationOn,
  Pending,
  Person,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import { Order, useAgentOrders } from '../../hooks/useAgentOrders';
import { useUserProfile } from '../../hooks/useUserProfile';
import AccountInformation from '../common/AccountInformation';
import OrderHistoryDialog from '../dialogs/OrderHistoryDialog';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'assigned_to_agent':
      return 'info';
    case 'picked_up':
      return 'primary';
    case 'in_transit':
      return 'secondary';
    case 'out_for_delivery':
      return 'success';
    case 'delivered':
      return 'success';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Pending />;
    case 'assigned_to_agent':
      return <CheckCircle />;
    case 'picked_up':
      return <DirectionsCar />;
    case 'in_transit':
    case 'out_for_delivery':
      return <LocalShipping />;
    case 'delivered':
      return <CheckCircle />;
    default:
      return <Pending />;
  }
};

const formatAddress = (address: any) => {
  if (!address) return 'No address';
  return `${address.address_line_1}, ${address.city}, ${address.state} ${address.postal_code}`;
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
};

const OrderCard: React.FC<{
  order: Order;
  onPickUp?: (orderId: string) => Promise<void>;
  onClaim?: (orderId: string) => Promise<void>;
  onDrop?: (orderId: string) => Promise<void>;
  onStatusUpdate?: (
    orderId: string,
    status: string,
    notes?: string
  ) => Promise<void>;
  showActions?: boolean;
  agentAddress?: any;
}> = ({
  order,
  onPickUp,
  onClaim,
  onDrop,
  onStatusUpdate,
  showActions = true,
  agentAddress,
}) => {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Distance Matrix integration
  const formatAddress = (address: any) => {
    if (!address) return '';
    return `${address.address_line_1}, ${address.city}, ${address.state} ${address.postal_code}`;
  };
  const origin =
    agentAddress && agentAddress.address
      ? formatAddress(agentAddress.address)
      : '';
  const pickupDestination =
    order.business_location && order.business_location.address
      ? formatAddress(order.business_location.address)
      : '';
  const deliveryDestination = order.delivery_address
    ? formatAddress(order.delivery_address)
    : '';

  React.useEffect(() => {}, [origin, pickupDestination, deliveryDestination]);

  const handlePickUp = async () => {
    if (!onPickUp) return;
    setUpdating(true);
    try {
      await onPickUp(order.id);
    } catch (error) {
      console.error('Error picking up order:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleClaim = async () => {
    if (!onClaim) return;
    setUpdating(true);
    try {
      await onClaim(order.id);
    } catch (error) {
      console.error('Error claiming order:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDrop = async () => {
    if (!onDrop) return;
    setUpdating(true);
    try {
      await onDrop(order.id);
    } catch (error) {
      console.error('Error dropping order:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleViewHistory = () => {
    setHistoryDialogOpen(true);
  };

  const getAvailableActions = (order: Order) => {
    const actions = [];
    switch (order.current_status) {
      case 'ready_for_pickup':
        actions.push({
          label: t('orderActions.claimOrder', 'Claim'),
          action: handleClaim,
          color: 'primary' as const,
          icon: <CheckCircle />,
        });
        break;
      case 'assigned_to_agent':
        actions.push({
          label: t('orderActions.pickUpOrder'),
          action: handlePickUp,
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        actions.push({
          label: t('orderActions.dropOrder', 'Drop'),
          action: handleDrop,
          color: 'error' as const,
          icon: <Cancel />,
        });
        break;
      case 'picked_up':
        actions.push({
          label: t('orderActions.markAsInTransit'),
          status: 'in_transit',
          color: 'primary' as const,
          icon: <LocalShipping />,
          action: () =>
            onStatusUpdate && onStatusUpdate(order.id, 'in_transit'),
        });
        actions.push({
          label: t('orderActions.markAsOutForDelivery'),
          status: 'out_for_delivery',
          color: 'secondary' as const,
          icon: <LocalShipping />,
          action: () =>
            onStatusUpdate && onStatusUpdate(order.id, 'out_for_delivery'),
        });
        break;
      case 'in_transit':
        actions.push({
          label: t('orderActions.markAsOutForDelivery'),
          status: 'out_for_delivery',
          color: 'secondary' as const,
          icon: <LocalShipping />,
          action: () =>
            onStatusUpdate && onStatusUpdate(order.id, 'out_for_delivery'),
        });
        break;
      case 'out_for_delivery':
        actions.push(
          {
            label: t('orderActions.markAsDelivered'),
            status: 'delivered',
            color: 'success' as const,
            icon: <CheckCircle />,
            action: () =>
              onStatusUpdate && onStatusUpdate(order.id, 'delivered'),
          },
          {
            label: t('orderActions.markAsFailed'),
            status: 'failed',
            color: 'error' as const,
            icon: <Cancel />,
            action: () => onStatusUpdate && onStatusUpdate(order.id, 'failed'),
          }
        );
        break;
    }
    return actions;
  };

  return (
    <Card sx={{ mb: 2, position: 'relative' }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h6" component="h3" gutterBottom>
              {t('orderCard.orderNumber', { orderNumber: order.order_number })}
            </Typography>
            <Chip
              icon={getStatusIcon(order.current_status)}
              label={t(`orderStatus.${order.current_status}`)}
              color={getStatusColor(order.current_status) as any}
              size="small"
            />
          </Box>
          <Typography variant="h6" color="primary">
            {formatCurrency(order.total_amount, order.currency)}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Business sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {order.business.name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {t('orderCard.pickup')}:{' '}
                {formatAddress(order.business_location.address)}
              </Typography>
            </Box>
            {(order as any).businessDistance && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DirectionsCar sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {t('orderCard.businessDistance')}:{' '}
                  {(order as any).businessDistance}
                  {(order as any).businessEstTime &&
                    ` (${(order as any).businessEstTime})`}
                </Typography>
              </Box>
            )}
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Person sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {order.client?.user.first_name} {order.client?.user.last_name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {t('orderCard.delivery')}:{' '}
                {formatAddress(order.delivery_address)}
              </Typography>
            </Box>
            {(order as any).deliveryDistance && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DirectionsCar sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {t('orderCard.deliveryDistance')}:{' '}
                  {(order as any).deliveryDistance}
                  {(order as any).deliveryEstTime &&
                    ` (${(order as any).deliveryEstTime})`}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {order.order_items.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('orderCard.items')} ({order.order_items.length}):
            </Typography>
            <List dense>
              {order.order_items.slice(0, 3).map((order_item, idx) => (
                <ListItem
                  key={order_item.id || order_item.item?.sku || idx}
                  sx={{ py: 1, alignItems: 'flex-start' }}
                >
                  {/* Item image */}
                  {order_item.item &&
                    order_item.item.item_images &&
                    order_item.item.item_images[0]?.image_url && (
                      <Avatar
                        src={order_item.item.item_images[0].image_url}
                        alt={order_item.item_name}
                        sx={{ width: 150, height: 150, mr: 2, mt: 0.5 }}
                        variant="rounded"
                      />
                    )}
                  <ListItemText
                    primary={
                      <Box>
                        <Typography
                          variant="subtitle2"
                          fontWeight={600}
                          component="div"
                        >
                          {(order_item.item &&
                            (order_item.item.model || order_item.item.name)) ||
                            order_item.item_name}
                        </Typography>
                        {order_item.item && order_item.item.sku && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            SKU: {order_item.item.sku}
                          </Typography>
                        )}
                        {order_item.item && order_item.item.brand?.name && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            Brand: {order_item.item.brand.name}
                          </Typography>
                        )}
                        {order_item.item &&
                          order_item.item.item_sub_category?.item_category
                            ?.name && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              component="div"
                            >
                              Category:{' '}
                              {
                                order_item.item.item_sub_category.item_category
                                  .name
                              }{' '}
                              → {order_item.item.item_sub_category.name}
                            </Typography>
                          )}
                        {order_item.item && order_item.item.size && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            Size: {order_item.item.size}{' '}
                            {order_item.item.size_unit || ''}
                          </Typography>
                        )}
                        {order_item.item && order_item.item.weight && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            Weight: {order_item.item.weight}{' '}
                            {order_item.item.weight_unit || ''}
                          </Typography>
                        )}
                        {order_item.item && order_item.item.color && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            Color: {order_item.item.color}
                          </Typography>
                        )}
                        <Typography
                          variant="body2"
                          color="text.primary"
                          component="div"
                        >
                          Quantity: {order_item.quantity}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="div"
                        >
                          Unit Price:{' '}
                          {formatCurrency(
                            order_item.unit_price,
                            order.currency
                          )}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="primary">
                        {formatCurrency(order_item.total_price, order.currency)}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
              {order.order_items.length > 3 && (
                <ListItem key="more-items" sx={{ py: 0 }}>
                  <ListItemText
                    secondary={`+${order.order_items.length - 3} ${t(
                      'orderCard.moreItems'
                    )}`}
                  />
                </ListItem>
              )}
            </List>
          </Box>
        )}

        {order.special_instructions && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('business.specialInstructions')}:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order.special_instructions}
            </Typography>
          </Box>
        )}
        {(order.current_status === 'assigned_to_agent' ||
          order.current_status === 'ready_for_pickup') && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" variant="outlined">
              Once you claim this order, you must deliver it within 24 hours or
              penalties may apply.
            </Alert>
          </Box>
        )}
      </CardContent>

      {showActions && (
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Box>
            {getAvailableActions(order).map((action, idx) => (
              <Button
                key={action.label}
                variant={
                  action.label === t('orderActions.claimOrder', 'Claim')
                    ? 'contained'
                    : 'outlined'
                }
                color={action.color}
                onClick={action.action}
                disabled={updating}
                startIcon={action.icon}
                sx={{
                  ml:
                    action.label === t('orderActions.claimOrder', 'Claim')
                      ? 0
                      : 1,
                }}
              >
                {updating ? <CircularProgress size={20} /> : action.label}
              </Button>
            ))}
            <Button
              variant="outlined"
              color="info"
              onClick={handleViewHistory}
              disabled={updating}
              startIcon={<History />}
              sx={{ ml: 1 }}
            >
              {t('orderActions.viewHistory', 'History')}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('common.created')}:{' '}
            {new Date(order.created_at).toLocaleDateString()}
          </Typography>
        </CardActions>
      )}

      <OrderHistoryDialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        orderHistory={order.order_status_history || []}
        orderNumber={order.order_number}
      />
    </Card>
  );
};

const AgentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth0();
  const { profile } = useUserProfile();
  const agentOrders = useAgentOrders();
  const {
    accounts,
    loading: accountLoading,
    error: accountError,
  } = useAccountInfo();
  const {
    categorizedOrders,
    loading,
    error,
    pickUpOrder,
    updateOrderStatusAction,
    getOrderForPickup,
  } = agentOrders;

  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleTopUpClick = () => {
    // Navigate to profile page for account management
    window.location.href = '/profile';
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handlePickUp = async (orderId: string) => {
    if (!profile?.id) {
      setNotification({
        open: true,
        message: t('messages.agentProfileNotFound'),
        severity: 'error',
      });
      return;
    }

    try {
      const result = await pickUpOrder(orderId);
      setNotification({
        open: true,
        message: t('messages.orderPickupSuccess', {
          orderNumber: result.order_number,
        }),
        severity: 'success',
      });
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.message || t('messages.orderPickupError'),
        severity: 'error',
      });
    }
  };

  const handleGetOrder = async (orderId: string) => {
    if (!profile?.id) {
      setNotification({
        open: true,
        message: t('messages.agentProfileNotFound'),
        severity: 'error',
      });
      return;
    }

    try {
      const result = await getOrderForPickup(orderId);
      setNotification({
        open: true,
        message: t('messages.orderAssignedSuccess', {
          orderNumber: result.order.order_number,
          holdAmount: result.holdAmount,
        }),
        severity: 'success',
      });
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.message || t('messages.orderAssignmentError'),
        severity: 'error',
      });
    }
  };

  const handleStatusUpdate = async (
    orderId: string,
    status: string,
    notes?: string
  ) => {
    try {
      const result = await updateOrderStatusAction(orderId, status, notes);
      setNotification({
        open: true,
        message: t('messages.orderStatusUpdateSuccess', {
          status: t(`orderStatus.${status}`),
        }),
        severity: 'success',
      });
      return result;
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.message || t('messages.orderStatusUpdateError'),
        severity: 'error',
      });
      throw error;
    }
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  const handleDrop = async (orderId: string) => {
    if (!profile?.id) {
      setNotification({
        open: true,
        message: t('messages.agentProfileNotFound'),
        severity: 'error',
      });
      return;
    }
    try {
      const result = await agentOrders.dropOrder(orderId);
      setNotification({
        open: true,
        message: t('messages.orderDropSuccess', {
          orderNumber: result.order_number,
        }),
        severity: 'success',
      });
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.message || t('messages.orderDropError'),
        severity: 'error',
      });
    }
  };

  if (loading || accountLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const totalOrders =
    categorizedOrders.active.length +
    categorizedOrders.inProgress.length +
    categorizedOrders.completed.length +
    categorizedOrders.cancelled.length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('agent.dashboard.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('dashboard.welcomeBack')}, {user?.name}!{' '}
          {t('dashboard.manageDeliveryOrders')}
        </Typography>
      </Box>

      {(error || accountError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || accountError}
        </Alert>
      )}

      {/* Account Information */}
      <AccountInformation
        accounts={accounts}
        onTopUpClick={handleTopUpClick}
        formatCurrency={formatCurrency}
      />

      {/* Active Orders Section */}
      {categorizedOrders.active.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <LocalShipping sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h5" component="h2">
              {t('dashboard.activeOrders')} ({categorizedOrders.active.length})
            </Typography>
          </Box>

          <Box>
            {categorizedOrders.active.map((order: Order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPickUp={handlePickUp}
                onDrop={handleDrop}
                onStatusUpdate={handleStatusUpdate}
                showActions={true}
                agentAddress={
                  profile?.agent && (profile.agent as any).address
                    ? (profile.agent as any).address
                    : undefined
                }
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* In Progress Orders Section */}
      {categorizedOrders.inProgress.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Pending sx={{ mr: 2, color: 'warning.main' }} />
            <Typography variant="h5" component="h2">
              {t('dashboard.inProgressOrders')} (
              {categorizedOrders.inProgress.length})
            </Typography>
          </Box>

          <Box>
            {categorizedOrders.inProgress.map((order: Order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPickUp={handlePickUp}
                onClaim={handleGetOrder}
                onDrop={handleDrop}
                onStatusUpdate={handleStatusUpdate}
                showActions={true}
                agentAddress={
                  profile?.agent && (profile.agent as any).address
                    ? (profile.agent as any).address
                    : undefined
                }
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Cancelled/Failed Orders Section */}
      {categorizedOrders.cancelled.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Cancel sx={{ mr: 2, color: 'error.main' }} />
            <Typography variant="h5" component="h2">
              {t('dashboard.cancelledOrders')} (
              {categorizedOrders.cancelled.length})
            </Typography>
          </Box>

          <Box>
            {categorizedOrders.cancelled.map((order: Order) => (
              <OrderCard
                key={order.id}
                order={order}
                showActions={false}
                agentAddress={
                  profile?.agent && (profile.agent as any).address
                    ? (profile.agent as any).address
                    : undefined
                }
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Completed Orders Section - At the bottom */}
      {categorizedOrders.completed.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <CheckCircle sx={{ mr: 2, color: 'success.main' }} />
            <Typography variant="h5" component="h2">
              {t('dashboard.completedOrders')} (
              {categorizedOrders.completed.length})
            </Typography>
          </Box>

          <Box>
            {categorizedOrders.completed.map((order: Order) => (
              <OrderCard
                key={order.id}
                order={order}
                showActions={false}
                agentAddress={
                  profile?.agent && (profile.agent as any).address
                    ? (profile.agent as any).address
                    : undefined
                }
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* No Orders Message */}
      {totalOrders === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Box sx={{ py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('dashboard.noOrders')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.noOrdersDescription')}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Success/Error Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AgentDashboard;
