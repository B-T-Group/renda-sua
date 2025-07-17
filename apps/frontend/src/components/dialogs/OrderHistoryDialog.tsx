import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator,
} from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  previous_status: string | null;
  notes: string;
  changed_by_type: string;
  changed_by_user_id: string;
  created_at: string;
  changed_by_user: {
    agent?: {
      user: {
        email: string;
        first_name: string;
        last_name: string;
      };
    };
    business?: {
      user: {
        email: string;
        first_name: string;
        last_name: string;
      };
    };
    client?: {
      user: {
        email: string;
        first_name: string;
        last_name: string;
      };
    };
  };
}

interface OrderHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  orderHistory: OrderStatusHistory[];
  orderNumber: string;
}

const OrderHistoryDialog: React.FC<OrderHistoryDialogProps> = ({
  open,
  onClose,
  orderHistory,
  orderNumber,
}) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'confirmed':
        return 'primary';
      case 'preparing':
        return 'warning';
      case 'ready_for_pickup':
        return 'info';
      case 'assigned_to_agent':
        return 'secondary';
      case 'picked_up':
        return 'primary';
      case 'in_transit':
        return 'info';
      case 'out_for_delivery':
        return 'warning';
      case 'delivered':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'error';
      case 'refunded':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'confirmed':
        return '✅';
      case 'preparing':
        return '👨‍🍳';
      case 'ready_for_pickup':
        return '📦';
      case 'assigned_to_agent':
        return '🚚';
      case 'picked_up':
        return '📥';
      case 'in_transit':
        return '🚛';
      case 'out_for_delivery':
        return '🛵';
      case 'delivered':
        return '🎉';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '🚫';
      case 'refunded':
        return '💰';
      default:
        return '📋';
    }
  };

  const getUserName = (historyItem: OrderStatusHistory) => {
    const user = historyItem.changed_by_user;
    if (user?.agent) {
      return `${user.agent.user.first_name} ${user.agent.user.last_name} (Agent)`;
    }
    if (user?.business) {
      return `${user.business.user.first_name} ${user.business.user.last_name} (Business)`;
    }
    if (user?.client) {
      return `${user.client.user.first_name} ${user.client.user.last_name} (Client)`;
    }
    return 'System';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const sortedHistory = [...orderHistory].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {t('orderHistory.title', 'Order History')} - {orderNumber}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {sortedHistory.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="text.secondary">
              {t('orderHistory.noHistory', 'No order history available.')}
            </Typography>
          </Box>
        ) : (
          <Timeline position="left">
            {sortedHistory.map((historyItem, index) => (
              <TimelineItem key={historyItem.id}>
                <TimelineOppositeContent
                  sx={{ m: 'auto 0' }}
                  variant="body2"
                  color="text.secondary"
                >
                  {formatDate(historyItem.created_at)}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot
                    sx={{
                      bgcolor:
                        getStatusColor(historyItem.status) === 'default'
                          ? 'grey.400'
                          : `${getStatusColor(historyItem.status)}.main`,
                      color: 'white',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {getStatusIcon(historyItem.status)}
                    </Typography>
                  </TimelineDot>
                  {index < sortedHistory.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ py: '12px', px: 2 }}>
                  <Box>
                    <Typography
                      variant="subtitle2"
                      component="span"
                      fontWeight="bold"
                    >
                      {t(
                        `orderStatus.${historyItem.status}`,
                        historyItem.status.replace(/_/g, ' ')
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {t('orderHistory.changedBy', 'Changed by')}:{' '}
                      {getUserName(historyItem)}
                    </Typography>
                    {historyItem.notes && (
                      <Typography
                        variant="body2"
                        sx={{ mt: 1, fontStyle: 'italic' }}
                      >
                        "{historyItem.notes}"
                      </Typography>
                    )}
                    {historyItem.previous_status && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: 'block' }}
                      >
                        {t('orderHistory.fromStatus', 'From')}:{' '}
                        {t(
                          `orderStatus.${historyItem.previous_status}`,
                          historyItem.previous_status.replace(/_/g, ' ')
                        )}
                      </Typography>
                    )}
                  </Box>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t('common.close', 'Close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderHistoryDialog;
