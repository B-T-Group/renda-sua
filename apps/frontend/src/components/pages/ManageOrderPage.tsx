import {
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccountInfo, useBackendOrders, useDeliveryFees } from '../../hooks';
import { useOrderById } from '../../hooks/useOrderById';
import { useUserProfile } from '../../hooks/useUserProfile';
import ConfirmationModal from '../common/ConfirmationModal';
import OrderView from '../common/OrderView';
import UserMessagesComponent from '../common/UserMessagesComponent';
import OrderHistoryDialog from '../dialogs/OrderHistoryDialog';
import RatingDialog from '../dialogs/RatingDialog';
import AgentActions from '../orders/AgentActions';
import AgentOrderAlerts from '../orders/AgentOrderAlerts';
import BusinessActions from '../orders/BusinessActions';
import BusinessOrderAlerts from '../orders/BusinessOrderAlerts';
import ClientActions from '../orders/ClientActions';
import ClientOrderAlerts from '../orders/ClientOrderAlerts';
import SEOHead from '../seo/SEOHead';

const ManageOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { profile } = useUserProfile();
  const { accounts } = useAccountInfo();
  const { deliveryFees, getDeliveryFeeForCurrency } = useDeliveryFees();

  const { order, loading, error, fetchOrder, refetch } = useOrderById();
  const {
    cancelOrder,
    refundOrder,
    completeOrder,
    loading: actionLoading,
    error: actionError,
  } = useBackendOrders();

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    label: string;
    color: string;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [notificationAlert, setNotificationAlert] = useState<{
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId, fetchOrder]);

  const handleBack = () => {
    // Navigate back to the smart orders route
    navigate('/orders');
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || !orderId) return;

    try {
      let response;
      const actionData = { orderId, notes: notes.trim() || undefined };

      switch (pendingAction.action) {
        case 'cancel':
          response = await cancelOrder(actionData);
          break;
        case 'refund':
          response = await refundOrder(actionData);
          break;
        case 'complete':
          response = await completeOrder(actionData);
          break;
        default:
          throw new Error(`Unknown action: ${pendingAction.action}`);
      }

      if (response.success) {
        // Refresh the order data
        await refetch();
      }
    } catch (error) {
      console.error('Failed to execute action:', error);
    } finally {
      setConfirmationOpen(false);
      setPendingAction(null);
      setNotes('');
    }
  };

  const handleCancelAction = () => {
    setConfirmationOpen(false);
    setPendingAction(null);
    setNotes('');
  };

  const handleShowNotification = (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => {
    setNotificationAlert({ message, severity });
    // Auto-clear success notifications after 5 seconds
    if (severity === 'success') {
      setTimeout(() => {
        setNotificationAlert(null);
      }, 5000);
    }
  };

  const handleClearNotification = () => {
    setNotificationAlert(null);
  };

  const shouldShowFinancialDetails = () => {
    // Show financial details for business admins or business owners
    return (
      profile?.business &&
      (profile.business.is_admin ||
        (order && order.business_id === profile.business.id))
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <IconButton onClick={handleBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">
            {t('orders.manageOrder', 'Manage Order')}
          </Typography>
        </Box>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <IconButton onClick={handleBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">
            {t('orders.manageOrder', 'Manage Order')}
          </Typography>
        </Box>
        <Alert severity="warning">
          {t('orders.orderNotFound', 'Order not found')}
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <SEOHead
        title={t('orders.manageOrder', 'Manage Order')}
        description={t(
          'orders.manageOrderDescription',
          'View and manage order details',
          {
            orderNumber: order.order_number,
          }
        )}
      />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={3}
        >
          <Box display="flex" alignItems="center">
            <IconButton onClick={handleBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4">
              {t('orders.manageOrder', 'Manage Order')}
            </Typography>
          </Box>
          <IconButton onClick={refetch} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>

        {/* Error Display */}
        {actionError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {actionError}
          </Alert>
        )}

        {/* Notification Alert */}
        {notificationAlert && (
          <Alert
            severity={notificationAlert.severity}
            sx={{ mb: 3 }}
            onClose={handleClearNotification}
          >
            {notificationAlert.message}
          </Alert>
        )}

        {/* Order View */}
        <Box sx={{ mb: 3 }}>
          <OrderView
            order={order}
            showFinancialDetails={shouldShowFinancialDetails() ?? false}
          />
        </Box>

        {/* Messages Section - Show to all users except agents who are not assigned to this order */}
        {(!profile?.agent ||
          order.assigned_agent_id === profile?.agent?.id) && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <UserMessagesComponent
                entityType="order"
                entityId={order.id}
                title={t('messages.orderMessages', 'Order Messages')}
                defaultExpanded={true}
                maxVisibleMessages={10}
                compact={false}
              />
            </CardContent>
          </Card>
        )}

        {/* Persona-specific alerts */}
        {profile?.agent && (
          <AgentOrderAlerts
            order={order}
            agentAccounts={accounts}
            deliveryFees={deliveryFees}
            getDeliveryFeeByCurrency={getDeliveryFeeForCurrency}
          />
        )}
        {profile?.business && <BusinessOrderAlerts order={order} />}
        {profile?.client && <ClientOrderAlerts order={order} />}

        {/* Order Actions - Persona-specific components */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('orders.availableActions', 'Available Actions')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Persona-specific actions */}
              {profile?.agent && (
                <AgentActions
                  order={order}
                  onActionComplete={() => refetch()}
                  onShowNotification={handleShowNotification}
                />
              )}
              {profile?.business && (
                <BusinessActions
                  order={order}
                  onActionComplete={() => refetch()}
                  onShowNotification={handleShowNotification}
                  onShowHistory={() => setHistoryDialogOpen(true)}
                />
              )}
              {profile?.client && (
                <ClientActions
                  order={order}
                  onActionComplete={() => refetch()}
                  onShowNotification={handleShowNotification}
                  onShowHistory={() => setHistoryDialogOpen(true)}
                />
              )}

              {/* Rating and History buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                {/* Show rating button for completed orders */}
                {order.current_status === 'complete' &&
                  profile?.user_type_id !== 'business' && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => setRatingDialogOpen(true)}
                      disabled={loading}
                    >
                      {t('orders.actions.rateOrder', 'Rate Order')}
                    </Button>
                  )}

                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<HistoryIcon />}
                  onClick={() => setHistoryDialogOpen(true)}
                  disabled={loading}
                >
                  {t('orders.actions.viewHistory', 'View History')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmationOpen}
        title={t('orders.confirmAction')}
        message={
          pendingAction
            ? t('orders.confirmActionMessage', {
                action: pendingAction.label,
                orderNumber: order.order_number,
              })
            : ''
        }
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        confirmColor={
          pendingAction?.color as
            | 'primary'
            | 'secondary'
            | 'error'
            | 'info'
            | 'success'
            | 'warning'
        }
        loading={actionLoading}
        additionalContent={
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('orders.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('orders.notesPlaceholder')}
            sx={{ mt: 2 }}
          />
        }
      />

      {/* Order History Dialog */}
      <OrderHistoryDialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        orderHistory={
          order.order_status_history?.map((history) => ({
            ...history,
            previous_status: history.previous_status || null,
            notes: history.notes || '',
          })) || []
        }
        orderNumber={order.order_number}
      />

      {/* Rating Dialog */}
      <RatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        orderId={order.id}
        orderNumber={order.order_number}
        userType={profile?.user_type_id as 'client' | 'agent' | 'business'}
        orderStatus={order.current_status}
        orderData={order}
      />
    </>
  );
};

export default ManageOrderPage;
