import {
  AccessTime as AccessTimeIcon,
  LocalShipping as LocalShippingIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../common/ConfirmationModal';

interface OrderAction {
  label: string;
  status: string;
  color: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  icon: React.ReactNode;
}

interface BusinessOrderCardProps {
  order: any; // TODO: Replace with proper Order type
  onStatusUpdate: (orderId: string, newStatus: string) => void;
  getAvailableActions: (order: any) => OrderAction[];
  getStatusColor: (status: string) => string;
  formatAddress: (address: any) => string;
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (dateString: string) => string;
  loading?: boolean;
  refreshOrders?: () => void;
}

const BusinessOrderCard: React.FC<BusinessOrderCardProps> = ({
  order,
  onStatusUpdate,
  getAvailableActions,
  getStatusColor,
  formatAddress,
  formatCurrency,
  formatDate,
  loading = false,
  refreshOrders,
}) => {
  const { t } = useTranslation();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    status: string;
    action: OrderAction;
  } | null>(null);

  const handleActionClick = (action: OrderAction) => {
    setPendingAction({ status: action.status, action });
    setConfirmationOpen(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (pendingAction) {
      try {
        await onStatusUpdate(order.id, pendingAction.status);
        // Optionally refresh orders if the function is provided
        if (refreshOrders) {
          refreshOrders();
        }
      } catch (error) {
        console.error('Failed to update order status:', error);
      } finally {
        setConfirmationOpen(false);
        setPendingAction(null);
      }
    }
  };

  const handleCancelStatusUpdate = () => {
    setConfirmationOpen(false);
    setPendingAction(null);
  };

  const getConfirmationMessage = (action: OrderAction) => {
    return t('business.orders.confirmStatusUpdate', {
      orderNumber: order.order_number,
      newStatus: action.label,
    });
  };

  const getConfirmationColor = (
    action: OrderAction
  ): 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning' => {
    return action.color;
  };

  return (
    <>
      <Card
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
              label={t(
                `business.orders.status.${order.current_status || 'unknown'}`
              )}
              color={getStatusColor(order.current_status || 'unknown') as any}
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
              {order.client?.user?.first_name} {order.client?.user?.last_name}
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
            {order.assigned_agent && (
              <Chip
                label={`${order.assigned_agent.user.first_name} ${order.assigned_agent.user.last_name}`}
                size="small"
                color="secondary"
              />
            )}
          </Box>
        </CardContent>
        <CardActions>
          {getAvailableActions(order).map((action) => (
            <Button
              key={action.status}
              size="small"
              color={action.color}
              variant="outlined"
              startIcon={action.icon}
              onClick={() => handleActionClick(action)}
              disabled={loading}
            >
              {action.label}
            </Button>
          ))}
        </CardActions>
      </Card>

      <ConfirmationModal
        open={confirmationOpen}
        title={t('business.orders.confirmTitle')}
        message={
          pendingAction ? getConfirmationMessage(pendingAction.action) : ''
        }
        confirmText={t('common.yes')}
        cancelText={t('common.no')}
        confirmColor={
          pendingAction ? getConfirmationColor(pendingAction.action) : 'primary'
        }
        loading={loading}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={handleCancelStatusUpdate}
      />
    </>
  );
};

export default BusinessOrderCard;
