import {
  Assignment,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FlashOn,
  Info,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../hooks/useOrders';

interface OrderActionCardProps {
  order: Order;
  userType: 'client' | 'business' | 'agent';
  formatCurrency: (amount: number, currency?: string) => string;
  onActionComplete?: () => void;
}

const OrderActionCard: React.FC<OrderActionCardProps> = ({
  order,
  userType,
  formatCurrency,
  onActionComplete,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const getActionRequiredInfo = () => {
    const status = order.current_status;

    switch (userType) {
      case 'business':
        switch (status) {
          case 'pending':
            return {
              required: true,
              severity: 'warning' as const,
              icon: <Assignment />,
              message: t(
                'orders.business.actionRequired.pending',
                'Action Required: Confirm this order'
              ),
              action: 'confirm',
            };
          case 'preparing':
            return {
              required: true,
              severity: 'info' as const,
              icon: <Info />,
              message: t(
                'orders.business.actionRequired.preparing',
                'Action Required: Complete preparation'
              ),
              action: 'complete_preparation',
            };
          default:
            return { required: false };
        }

      case 'client':
        return { required: false };

      case 'agent':
        switch (status) {
          case 'ready_for_pickup':
            if (!order.assigned_agent_id) {
              return {
                required: true,
                severity: 'info' as const,
                icon: <Assignment />,
                message: t(
                  'orders.agent.actionRequired.ready_for_pickup',
                  'Action Required: Claim this order'
                ),
                action: 'claim_order',
              };
            }
            return { required: false };
          case 'picked_up':
            return {
              required: true,
              severity: 'warning' as const,
              icon: <Warning />,
              message: t(
                'orders.agent.actionRequired.picked_up',
                'Action Required: Start delivery'
              ),
              action: 'start_delivery',
            };
          case 'in_transit':
            return {
              required: true,
              severity: 'info' as const,
              icon: <Info />,
              message: t(
                'orders.agent.actionRequired.in_transit',
                'Action Required: Update delivery status'
              ),
              action: 'update_status',
            };
          default:
            return { required: false };
        }

      default:
        return { required: false };
    }
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
      case 'picked_up':
        return 'primary';
      case 'in_transit':
        return 'primary';
      case 'out_for_delivery':
        return 'secondary';
      case 'delivered':
        return 'success';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get unique item images from order items
  const getOrderImages = () => {
    if (!order.order_items || order.order_items.length === 0) return [];

    const images: string[] = [];
    order.order_items.forEach((item) => {
      const imageUrl = item.item?.item_images?.[0]?.image_url;
      if (imageUrl && !images.includes(imageUrl)) {
        images.push(imageUrl);
      }
    });
    return images;
  };

  const orderImages = getOrderImages();

  // Reset image index when order images change
  useEffect(() => {
    if (currentImageIndex >= orderImages.length && orderImages.length > 0) {
      setCurrentImageIndex(0);
    }
  }, [orderImages.length, currentImageIndex]);

  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? orderImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === orderImages.length - 1 ? 0 : prev + 1
    );
  };

  const actionInfo = getActionRequiredInfo();

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Order Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            Order #{order.order_number}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={t(
                `common.orderStatus.${order.current_status}`,
                order.current_status
              )}
              color={getStatusColor(order.current_status) as any}
              size="small"
            />
            {order.requires_fast_delivery && (
              <Chip
                label={t('orders.fastDelivery.title', 'Fast Delivery')}
                color="warning"
                size="small"
                icon={<FlashOn fontSize="small" />}
              />
            )}
          </Box>
        </Box>

        {/* Action Required Alert */}
        {actionInfo.required && (
          <Alert
            severity={actionInfo.severity}
            icon={actionInfo.icon}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {actionInfo.message}
            </Typography>
          </Alert>
        )}

        {/* Number of Items */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" color="text.secondary">
            <strong>{t('orders.items', 'Items')}:</strong>{' '}
            {order.order_items?.length || 0}
          </Typography>
        </Box>

        {/* Order Images Carousel */}
        {orderImages.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>{t('orders.orderImages', 'Order Images')}</strong>
            </Typography>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'grey.100',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {/* Main Image */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '56.25%', // 16:9 aspect ratio
                  overflow: 'hidden',
                  bgcolor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={orderImages[currentImageIndex]}
                  alt={t('orders.orderImage', 'Order item')}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div style="
                          position: absolute;
                          top: 0;
                          left: 0;
                          width: 100%;
                          height: 100%;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          font-size: 2rem;
                          color: #999;
                        ">
                          <span role="img" aria-label="package">📦</span>
                        </div>
                      `;
                    }
                  }}
                />

                {/* Navigation Buttons - Only show if multiple images */}
                {orderImages.length > 1 && (
                  <>
                    <IconButton
                      onClick={handlePreviousImage}
                      sx={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        bgcolor: 'rgba(0, 0, 0, 0.5)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.7)',
                        },
                      }}
                      aria-label={t('common.previous', 'Previous')}
                    >
                      <ChevronLeft />
                    </IconButton>
                    <IconButton
                      onClick={handleNextImage}
                      sx={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        bgcolor: 'rgba(0, 0, 0, 0.5)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.7)',
                        },
                      }}
                      aria-label={t('common.next', 'Next')}
                    >
                      <ChevronRight />
                    </IconButton>
                  </>
                )}

                {/* Image Counter - Only show if multiple images */}
                {orderImages.length > 1 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.875rem',
                    }}
                  >
                    {currentImageIndex + 1} / {orderImages.length}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Fallback when no images */}
        {orderImages.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 120,
              bgcolor: 'grey.50',
              borderRadius: 1,
              mb: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              <span
                role="img"
                aria-label="package"
                style={{ fontSize: '2rem' }}
              >
                📦
              </span>
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={() => navigate(`/orders/${order.id}`)}
        >
          {actionInfo.required
            ? t('orders.viewAndTakeAction', 'View & Take Action')
            : t('orders.viewDetails', 'View Details')}
        </Button>
      </CardActions>
    </Card>
  );
};

export default OrderActionCard;
