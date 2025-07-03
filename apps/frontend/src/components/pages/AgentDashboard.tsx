import { useAuth0 } from '@auth0/auth0-react';
import {
  Business,
  Cancel,
  CheckCircle,
  DirectionsCar,
  LocalShipping,
  LocationOn,
  Pending,
  Person,
} from '@mui/icons-material';
import {
  Alert,
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
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Order, useAgentOrders } from '../../hooks/useAgentOrders';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import { useUserProfile } from '../../hooks/useUserProfile';

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
  onUpdateStatus?: (orderId: string, status: string) => Promise<void>;
  showActions?: boolean;
}> = ({ order, onPickUp, onUpdateStatus, showActions = true }) => {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);

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

  const handleStatusUpdate = async (status: string) => {
    if (!onUpdateStatus) return;
    setUpdating(true);
    try {
      await onUpdateStatus(order.id, status);
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'assigned_to_agent':
        return 'picked_up';
      case 'picked_up':
        return 'in_transit';
      case 'in_transit':
        return 'out_for_delivery';
      case 'out_for_delivery':
        return 'delivered';
      default:
        return null;
    }
  };

  const getAvailableActions = (order: Order) => {
    const actions = [];

    switch (order.current_status) {
      case 'ready_for_pickup':
        actions.push({
          label: t('orderActions.getOrder'),
          status: 'assigned_to_agent',
          color: 'primary' as const,
          icon: <CheckCircle />,
        });
        break;
      case 'assigned_to_agent':
        actions.push({
          label: t('orderActions.pickUpOrder'),
          status: 'picked_up',
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        break;
      case 'picked_up':
        actions.push({
          label: t('orderActions.markAsInTransit'),
          status: 'in_transit',
          color: 'primary' as const,
          icon: <LocalShipping />,
        });
        break;
      case 'in_transit':
        actions.push({
          label: t('orderActions.markAsOutForDelivery'),
          status: 'out_for_delivery',
          color: 'secondary' as const,
          icon: <LocalShipping />,
        });
        break;
      case 'out_for_delivery':
        actions.push(
          {
            label: t('orderActions.markAsDelivered'),
            status: 'delivered',
            color: 'success' as const,
            icon: <CheckCircle />,
          },
          {
            label: t('orderActions.markAsFailed'),
            status: 'failed',
            color: 'error' as const,
            icon: <Cancel />,
          }
        );
        break;
    }

    return actions;
  };

  const nextStatus = getNextStatus(order.current_status);

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
          </Box>
        </Box>

        {order.order_items.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('orderCard.items')} ({order.order_items.length}):
            </Typography>
            <List dense>
              {order.order_items.slice(0, 3).map((item) => (
                <ListItem key={item.id} sx={{ py: 0 }}>
                  <ListItemText
                    primary={item.item_name}
                    secondary={`${item.quantity}x ${formatCurrency(
                      item.unit_price,
                      order.currency
                    )}`}
                  />
                  <ListItemSecondaryAction>
                    <Typography variant="body2" color="primary">
                      {formatCurrency(item.total_price, order.currency)}
                    </Typography>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {order.order_items.length > 3 && (
                <ListItem sx={{ py: 0 }}>
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
      </CardContent>

      {showActions && (
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Box>
            {getAvailableActions(order).map((action) => (
              <Button
                key={action.status}
                variant={
                  action.status === 'assigned_to_agent'
                    ? 'contained'
                    : 'outlined'
                }
                color={action.color}
                onClick={() => handleStatusUpdate(action.status)}
                disabled={updating}
                startIcon={action.icon}
                sx={{ ml: action.status === 'assigned_to_agent' ? 0 : 1 }}
              >
                {updating ? <CircularProgress size={20} /> : action.label}
              </Button>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('common.created')}:{' '}
            {new Date(order.created_at).toLocaleDateString()}
          </Typography>
        </CardActions>
      )}
    </Card>
  );
};

const AgentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth0();
  const { profile } = useUserProfile();
  const {
    activeOrders,
    pendingOrders,
    loading,
    error,
    pickUpOrder,
    updateOrderStatusAction,
  } = useAgentOrders();
  const {
    updateOrderStatus,
    loading: updateLoading,
    error: updateError,
  } = useBackendOrders();

  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

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

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      setNotification({
        open: true,
        message: t('messages.orderStatusUpdateSuccess', {
          status: t(`orderStatus.${status}`),
        }),
        severity: 'success',
      });
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.message || t('messages.orderStatusUpdateError'),
        severity: 'error',
      });
    }
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  if (loading) {
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('dashboard.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('dashboard.welcomeBack')}, {user?.name}!{' '}
          {t('dashboard.manageDeliveryOrders')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Active Orders Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <LocalShipping sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h5" component="h2">
            {t('dashboard.activeOrders')} ({activeOrders.length})
          </Typography>
        </Box>

        {activeOrders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {t('dashboard.noActiveOrders')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.pickUpPendingOrders')}
            </Typography>
          </Box>
        ) : (
          <Box>
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleStatusUpdate}
                showActions={true}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Pending Orders Section */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Pending sx={{ mr: 2, color: 'warning.main' }} />
          <Typography variant="h5" component="h2">
            {t('dashboard.pendingOrders')} ({pendingOrders.length})
          </Typography>
        </Box>

        {pendingOrders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {t('dashboard.noPendingOrders')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.newOrdersWillAppear')}
            </Typography>
          </Box>
        ) : (
          <Box>
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPickUp={handlePickUp}
                showActions={true}
              />
            ))}
          </Box>
        )}
      </Paper>

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
