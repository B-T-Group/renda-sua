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
import { useBackendOrders } from '../../hooks';
import { useOrderById } from '../../hooks/useOrderById';
import { useUserProfile } from '../../hooks/useUserProfile';
import ConfirmationModal from '../common/ConfirmationModal';
import OrderView from '../common/OrderView';
import UserMessagesComponent from '../common/UserMessagesComponent';
import OrderHistoryDialog from '../dialogs/OrderHistoryDialog';
import SEOHead from '../seo/SEOHead';

const ManageOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { profile } = useUserProfile();

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

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId, fetchOrder]);

  const handleBack = () => {
    // Navigate back to the smart orders route
    navigate('/orders');
  };

  const getAvailableActions = () => {
    if (!order || !profile) return [];

    const actions = [];
    const status = order.current_status;

    // Business user actions
    if (profile.business) {
      // Business owns the order or is admin
      const isOwner = order.business_id === profile.business.id;
      const isAdmin = profile.business.is_admin;

      if (isOwner || isAdmin) {
        switch (status) {
          case 'pending':
          case 'confirmed':
          case 'preparing':
            actions.push({
              action: 'cancel',
              label: t('orders.actions.cancel'),
              color: 'error',
            });
            break;
          case 'delivered':
          case 'failed':
          case 'cancelled':
            actions.push({
              action: 'refund',
              label: t('orders.actions.refund'),
              color: 'warning',
            });
            break;
        }
      }
    }

    // Client user actions
    if (profile.client && order.client_id === profile.client.id) {
      switch (status) {
        case 'pending':
        case 'confirmed':
          actions.push({
            action: 'cancel',
            label: t('orders.actions.cancel'),
            color: 'error',
          });
          break;
        case 'delivered':
          actions.push({
            action: 'complete',
            label: t('orders.actions.complete'),
            color: 'success',
          });
          break;
      }
    }

    // Agent user actions (if assigned to the order)
    if (profile.agent && order.assigned_agent_id === profile.agent.id) {
      // Agent actions are typically handled in specialized agent pages
      // but can be added here if needed
    }

    return actions;
  };

  const handleActionClick = (action: string, label: string, color: string) => {
    setPendingAction({ action, label, color });
    setConfirmationOpen(true);
    setNotes('');
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

  const availableActions = getAvailableActions();

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

        {/* Order View */}
        <Box sx={{ mb: 3 }}>
          <OrderView
            order={order}
            showFinancialDetails={shouldShowFinancialDetails()}
          />
        </Box>

        {/* Messages Section */}
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

        {/* Order Actions - Moved to bottom */}
        {availableActions.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('orders.availableActions', 'Available Actions')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {availableActions.map((action) => (
                  <Button
                    key={action.action}
                    variant="outlined"
                    color={action.color as any}
                    onClick={() =>
                      handleActionClick(
                        action.action,
                        action.label,
                        action.color
                      )
                    }
                    disabled={actionLoading}
                  >
                    {action.label}
                  </Button>
                ))}
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<HistoryIcon />}
                  onClick={() => setHistoryDialogOpen(true)}
                  disabled={actionLoading}
                >
                  {t('orders.actions.viewHistory', 'View History')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
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
        confirmColor={pendingAction?.color as any}
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
        orderHistory={order.order_status_history || []}
        orderNumber={order.order_number}
      />
    </>
  );
};

export default ManageOrderPage;
