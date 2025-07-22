import {
  AccessTime as AccessTimeIcon,
  History as HistoryIcon,
  LocalShipping as LocalShippingIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDistanceMatrix } from '../../hooks/useDistanceMatrix';
import ConfirmationModal from '../common/ConfirmationModal';
import OrderHistoryDialog from '../dialogs/OrderHistoryDialog';

interface OrderAction {
  label: string;
  status: string;
  color: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  icon: React.ComponentType;
}

interface BusinessOrderCardProps {
  order: any; // TODO: Replace with proper Order type
  onStatusUpdate: (orderId: string, newStatus: string, notes?: string) => void;
  getAvailableActions: (order: any) => OrderAction[];
  getStatusColor: (status: string) => string;
  formatAddress: (address: any) => string;
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (dateString: string) => string;
  loading?: boolean;
  refreshOrders?: () => void;
  businessAddress: string;
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
  businessAddress,
}) => {
  const { t } = useTranslation();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    status: string;
    action: OrderAction;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Distance Matrix integration
  const {
    data: distanceData,
    loading: distanceLoading,
    error: distanceError,
    fetchDistanceMatrix,
  } = useDistanceMatrix();
  useEffect(() => {
    if (businessAddress && order.delivery_address) {
      const destination = formatAddress(order.delivery_address);
      if (destination) {
        fetchDistanceMatrix({
          destination_address_ids: [destination],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessAddress, order.delivery_address]);

  const handleActionClick = (action: OrderAction) => {
    setPendingAction({ status: action.status, action });
    setConfirmationOpen(true);
    setNotes('');
  };

  const handleConfirmStatusUpdate = async () => {
    if (pendingAction) {
      try {
        await onStatusUpdate(
          order.id,
          pendingAction.status,
          notes.trim() || undefined
        );
        // Optionally refresh orders if the function is provided
        if (refreshOrders) {
          refreshOrders();
        }
      } catch (error) {
        console.error('Failed to update order status:', error);
      } finally {
        setConfirmationOpen(false);
        setPendingAction(null);
        setNotes('');
      }
    }
  };

  const handleCancelStatusUpdate = () => {
    setConfirmationOpen(false);
    setPendingAction(null);
    setNotes('');
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
          width: '100%',
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
              {t('business.common.orderNumber', {
                number: order.order_number,
              })}
            </Typography>
            <Chip
              label={t(
                `common.orderStatus.${order.current_status || 'unknown'}`
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
            {order.client?.user?.phone_number && (
              <Typography
                variant="body2"
                color="text.secondary"
                display="flex"
                alignItems="center"
                mb={1}
              >
                <PhoneIcon sx={{ mr: 1, fontSize: 16 }} />
                {t('common.phone')}: {order.client.user.phone_number}
              </Typography>
            )}
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
            {/* Distance Matrix display */}
            {distanceLoading && (
              <Typography variant="body2" color="text.secondary">
                {t('common.loading')} distance...
              </Typography>
            )}
            {distanceError && (
              <Typography variant="body2" color="error">
                {t('common.error')}: {distanceError}
              </Typography>
            )}
            {distanceData &&
              distanceData.rows[0]?.elements[0]?.status === 'OK' && (
                <Typography variant="body2" color="text.secondary">
                  {t('business.orders.table.distance')}:{' '}
                  {distanceData.rows[0]?.elements[0]?.distance?.text},{' '}
                  {t('business.orders.table.duration')}:{' '}
                  {distanceData.rows[0]?.elements[0]?.duration?.text}
                </Typography>
              )}
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
          {getAvailableActions(order).map((action) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={action.status}
                size="small"
                color={action.color}
                variant="outlined"
                startIcon={<IconComponent />}
                onClick={() => handleActionClick(action)}
                disabled={loading}
              >
                {action.label}
              </Button>
            );
          })}
          <Button
            size="small"
            color="info"
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => setItemsDialogOpen(true)}
            disabled={loading}
          >
            {t('business.orders.actions.viewItems', 'View Items')}
          </Button>
          <Button
            size="small"
            color="secondary"
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setHistoryDialogOpen(true)}
            disabled={loading}
          >
            {t('business.orders.actions.viewHistory', 'History')}
          </Button>
        </CardActions>
      </Card>

      <ConfirmationModal
        open={confirmationOpen}
        title={t('business.orders.confirmTitle')}
        message={
          pendingAction ? getConfirmationMessage(pendingAction.action) : ''
        }
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={handleCancelStatusUpdate}
        confirmColor={
          pendingAction ? getConfirmationColor(pendingAction.action) : 'primary'
        }
        loading={loading}
        additionalContent={
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('business.orders.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('business.orders.notesPlaceholder')}
            sx={{ mt: 2 }}
          />
        }
      />
      {/* Order Items Dialog */}
      <Dialog
        open={itemsDialogOpen}
        onClose={() => setItemsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('business.orders.itemsInOrder', 'Order Items')}
        </DialogTitle>
        <DialogContent dividers>
          {order.order_items && order.order_items.length > 0 ? (
            <List>
              {order.order_items.map((order_item: any, idx: number) => (
                <React.Fragment key={order_item.id || idx}>
                  <ListItem alignItems="flex-start">
                    {/* Item image and details */}
                    <Box display="flex" alignItems="center" width="100%" mx={2}>
                      {order_item.item.item_images &&
                        order_item.item.item_images[0]?.image_url && (
                          <Avatar
                            src={order_item.item.item_images[0].image_url}
                            alt={order_item.item_name}
                            sx={{ width: 150, height: 150, mr: 2 }}
                            variant="rounded"
                          />
                        )}
                      <Box flex={1} flexDirection={'column'} minWidth={0}>
                        <Typography
                          variant="subtitle1"
                          fontWeight={600}
                          component="div"
                          sx={{ mb: 0.5 }}
                        >
                          {order_item.item.model || order_item.item_name}
                        </Typography>
                        {order_item.item.sku && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            sx={{ mb: 0.5 }}
                          >
                            SKU: {order_item.item.sku}
                          </Typography>
                        )}
                        {order_item.item.brand?.name && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                          >
                            {t('business.items.brand', 'Brand')}:{' '}
                            {order_item.item.brand.name}
                          </Typography>
                        )}
                        {order_item.item.item_sub_category?.item_category
                          ?.name && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            sx={{ mb: 0.5 }}
                          >
                            {t('business.items.category', 'Category')}:{' '}
                            {
                              order_item.item.item_sub_category.item_category
                                .name
                            }{' '}
                            → {order_item.item.item_sub_category.name}
                          </Typography>
                        )}
                        {order_item.item.weight && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            sx={{ mb: 0.5 }}
                          >
                            {t('business.items.weight', 'Weight')}:{' '}
                            {order_item.item.weight}{' '}
                            {order_item.item.weight_unit || ''}
                          </Typography>
                        )}
                        {order_item.item.color && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            sx={{ mb: 0.5 }}
                          >
                            {t('business.items.color', 'Color')}:{' '}
                            {order_item.item.color}
                          </Typography>
                        )}
                        <Typography
                          component="div"
                          variant="body2"
                          color="text.primary"
                          sx={{ mb: 0.5 }}
                        >
                          {t('business.orders.table.quantity', 'Quantity')}:{' '}
                          {order_item.quantity}
                        </Typography>
                        <Typography
                          component="div"
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 0.5 }}
                        >
                          {t('business.orders.table.unitPrice', 'Unit Price')}:{' '}
                          {formatCurrency(
                            order_item.unit_price,
                            order.currency
                          )}
                        </Typography>
                        <Typography
                          component="div"
                          variant="body2"
                          color="text.secondary"
                        >
                          {t('business.orders.table.totalPrice', 'Total')}:{' '}
                          {formatCurrency(
                            order_item.total_price,
                            order.currency
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </ListItem>
                  {idx < order.order_items.length - 1 && (
                    <Divider component="li" />
                  )}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary">
              {t('business.orders.noItems', 'No items in this order.')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setItemsDialogOpen(false)}
            color="primary"
            variant="contained"
          >
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>

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

export default BusinessOrderCard;
