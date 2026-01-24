import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  CheckCircle,
  Event,
  History as HistoryIcon,
  LocalShipping,
  LocationOn,
  Payment,
  Phone,
  Receipt,
  Refresh as RefreshIcon,
  ShoppingBag,
  Star,
  Store,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Step,
  StepConnector,
  stepConnectorClasses,
  StepIconProps,
  StepLabel,
  Stepper,
  styled,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo, useBackendOrders } from '../../hooks';
import { useOrderById } from '../../hooks/useOrderById';
import { useOrderRatings } from '../../hooks/useOrderRatings';
import ConfirmationModal from '../common/ConfirmationModal';
import DeliveryTimeWindowDisplay from '../common/DeliveryTimeWindowDisplay';
import OrderRatingsDisplay from '../common/OrderRatingsDisplay';
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

// Custom Step Connector
const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage:
        'linear-gradient( 95deg,rgb(25,118,210) 0%,rgb(33,150,243) 50%,rgb(66,165,245) 100%)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage:
        'linear-gradient( 95deg,rgb(46,125,50) 0%,rgb(56,142,60) 50%,rgb(76,175,80) 100%)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor:
      theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderRadius: 1,
  },
}));

// Custom Step Icon
const ColorlibStepIconRoot = styled('div')<{
  ownerState: { completed?: boolean; active?: boolean };
}>(({ theme, ownerState }) => ({
  backgroundColor:
    theme.palette.mode === 'dark' ? theme.palette.grey[700] : '#ccc',
  zIndex: 1,
  color: '#fff',
  width: 50,
  height: 50,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  ...(ownerState.active && {
    backgroundImage:
      'linear-gradient( 136deg, rgb(25,118,210) 0%, rgb(33,150,243) 50%, rgb(66,165,245) 100%)',
    boxShadow: '0 4px 10px 0 rgba(0,0,0,.25)',
  }),
  ...(ownerState.completed && {
    backgroundImage:
      'linear-gradient( 136deg, rgb(46,125,50) 0%, rgb(56,142,60) 50%, rgb(76,175,80) 100%)',
  }),
}));

function ColorlibStepIcon(props: StepIconProps) {
  const { active, completed, className } = props;

  const icons: { [index: string]: React.ReactElement } = {
    1: <ShoppingBag />,
    2: <Payment />,
    3: <CheckCircle />,
    4: <Store />,
    5: <LocalShipping />,
    6: <CheckCircle />,
  };

  return (
    <ColorlibStepIconRoot
      ownerState={{ completed, active }}
      className={className}
    >
      {icons[String(props.icon)]}
    </ColorlibStepIconRoot>
  );
}

// Loading Skeleton Component
const OrderDetailSkeleton: React.FC = () => (
  <Container
        maxWidth="xl"
        sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, sm: 2 } }}
      >
    <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Skeleton variant="circular" width={40} height={40} />
      <Skeleton variant="text" width={200} height={40} />
    </Box>
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
            <Skeleton
              variant="rectangular"
              height={120}
              sx={{ mb: 2, borderRadius: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Skeleton
                variant="rectangular"
                width="30%"
                height={60}
                sx={{ borderRadius: 2 }}
              />
              <Skeleton
                variant="rectangular"
                width="30%"
                height={60}
                sx={{ borderRadius: 2 }}
              />
              <Skeleton
                variant="rectangular"
                width="30%"
                height={60}
                sx={{ borderRadius: 2 }}
              />
            </Box>
          </CardContent>
        </Card>
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Grid>
    </Grid>
  </Container>
);

const ManageOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { orderId } = useParams<{ orderId: string }>();
  const { profile } = useUserProfileContext();
  const { accounts } = useAccountInfo();

  const { order, loading, error, fetchOrder, refetch } = useOrderById();
  const { ratings, refetch: refetchRatings } = useOrderRatings(orderId || '');

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
  // Set default tab to Delivery (1) for agents, Details (0) for others
  const [activeTab, setActiveTab] = useState(profile?.agent ? 1 : 0);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
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
        return 'primary';
      case 'out_for_delivery':
        return 'secondary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'failed':
        return 'error';
      case 'refunded':
        return 'warning';
      case 'complete':
        return 'success';
      default:
        return 'default';
    }
  };

  const getOrderStep = (status: string): number => {
    const steps = {
      pending: 0,
      pending_payment: 0,
      confirmed: 1,
      preparing: 2,
      ready_for_pickup: 3,
      assigned_to_agent: 3,
      picked_up: 4,
      in_transit: 4,
      out_for_delivery: 4,
      delivered: 5,
      complete: 5,
    };
    return steps[status as keyof typeof steps] ?? 0;
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatAddress = (address: any) => {
    if (!address) return '';
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId, fetchOrder]);

  // Set default tab to Delivery for agents when component mounts
  useEffect(() => {
    if (profile?.agent) {
      setActiveTab(1);
    }
  }, [profile?.agent]);

  const handleBack = () => {
    // Navigate back to the smart orders route
    navigate('/orders');
  };

  const handleCancelOrder = (orderId: string) => {
    setPendingAction({
      action: 'cancel',
      label: t('orders.actions.cancel', 'Cancel Order'),
      color: 'error',
    });
    setConfirmationOpen(true);
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

  // Show skeleton while loading
  if (loading) {
    return <OrderDetailSkeleton />;
  }

  // Show error state
  if (error || !order) {
    return (
      <Container
        maxWidth="xl"
        sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, sm: 2 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            {t('orders.manageOrder', 'Order Details')}
          </Typography>
        </Box>
        <Alert
          severity={error ? 'error' : 'warning'}
          action={
            error && (
              <Button color="inherit" size="small" onClick={() => refetch()}>
                {t('common.retry', 'Retry')}
              </Button>
            )
          }
        >
          {error || t('orders.orderNotFound', 'Order not found')}
        </Alert>
      </Container>
    );
  }

  const currentStep = getOrderStep(order.current_status);
  const isCancelled = ['cancelled', 'failed', 'refunded'].includes(
    order.current_status
  );

  return (
    <>
      <SEOHead
        title={`${t('orders.orderNumber', 'Order')} #${order.order_number}`}
        description={t(
          'orders.manageOrderDescription',
          'View and manage order details'
        )}
      />
      <Box
        sx={{
          bgcolor: 'grey.50',
          minHeight: '100vh',
          pb: 4,
          // Add bottom padding on mobile for agents to account for sticky action bar + bottom nav
          // Add bottom padding on mobile for clients to account for bottom nav (64px) + action buttons
          paddingBottom:
            profile?.agent && isMobile
              ? { xs: '200px', md: 4 }
              : profile?.client && isMobile
                ? { xs: '140px', md: 4 }
                : 4,
        }}
      >
        <Container
        maxWidth="xl"
        sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, sm: 2 } }}
      >
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={handleBack}
                  sx={{
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Box>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
                  >
                    {t('orders.orderNumber', 'Order')} #{order.order_number}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.placedOn', 'Placed on')}{' '}
                    {formatDate(order.created_at)}
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  color={getStatusColor(order.current_status) as any}
                  label={t(`common.orderStatus.${order.current_status}`)}
                  size="medium"
                  sx={{ fontWeight: 600, px: 2, py: 2.5 }}
                />
                <IconButton
                  onClick={refetch}
                  disabled={loading}
                  sx={{
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Stack>
            </Box>

            {/* Error Display */}
            {actionError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {actionError}
              </Alert>
            )}

            {/* Notification Alert */}
            {notificationAlert && (
              <Alert
                severity={notificationAlert.severity}
                sx={{ mb: 2 }}
                onClose={handleClearNotification}
              >
                {notificationAlert.message}
              </Alert>
            )}
          </Box>

          {/* Order Progress Stepper */}
          {!isCancelled && (
            <Card sx={{ mb: 3, overflow: 'visible' }}>
              <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <TimelineIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" fontWeight="bold">
                    {t('orders.orderProgress', 'Order Progress')}
                  </Typography>
                </Box>
                <Stepper
                  alternativeLabel
                  activeStep={currentStep}
                  connector={<ColorlibConnector />}
                  sx={{ display: { xs: 'none', md: 'flex' } }}
                >
                  <Step>
                    <StepLabel StepIconComponent={ColorlibStepIcon}>
                      {t('orders.status.pending', 'Order Placed')}
                    </StepLabel>
                  </Step>
                  <Step>
                    <StepLabel StepIconComponent={ColorlibStepIcon}>
                      {t('orders.status.confirmed', 'Confirmed')}
                    </StepLabel>
                  </Step>
                  <Step>
                    <StepLabel StepIconComponent={ColorlibStepIcon}>
                      {t('orders.status.preparing', 'Preparing')}
                    </StepLabel>
                  </Step>
                  <Step>
                    <StepLabel StepIconComponent={ColorlibStepIcon}>
                      {t('orders.status.ready', 'Ready')}
                    </StepLabel>
                  </Step>
                  <Step>
                    <StepLabel StepIconComponent={ColorlibStepIcon}>
                      {t('orders.status.inTransit', 'In Transit')}
                    </StepLabel>
                  </Step>
                  <Step>
                    <StepLabel StepIconComponent={ColorlibStepIcon}>
                      {t('orders.status.delivered', 'Delivered')}
                    </StepLabel>
                  </Step>
                </Stepper>

                {/* Mobile Progress Bar */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t('orders.progress', 'Progress')}:{' '}
                      {Math.round((currentStep / 5) * 100)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(currentStep / 5) * 100}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                  <Typography variant="body1" fontWeight="medium">
                    {t(`common.orderStatus.${order.current_status}`)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}

          <Grid container spacing={3}>
            {/* Main Content - Left Column */}
            <Grid size={{ xs: 12, md: 8 }}>
              {/* Persona-specific alerts */}
              {/* eslint-disable @typescript-eslint/no-explicit-any */}
              {profile?.agent && <AgentOrderAlerts order={order as any} />}
              {profile?.business && (
                <BusinessOrderAlerts
                  order={order as any}
                  onCancelOrder={handleCancelOrder}
                />
              )}
              {profile?.client && <ClientOrderAlerts order={order as any} />}
              {/* eslint-enable @typescript-eslint/no-explicit-any */}

              {/* Tabbed Content */}
              <Card sx={{ mb: 3 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs
                    value={activeTab}
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    variant={isMobile ? 'fullWidth' : 'standard'}
                    sx={{ px: 2 }}
                  >
                    <Tab
                      icon={<Receipt />}
                      iconPosition="start"
                      label={t('orders.details', 'Details')}
                    />
                    <Tab
                      icon={<LocalShipping />}
                      iconPosition="start"
                      label={t('orders.delivery', 'Delivery')}
                    />
                    <Tab
                      icon={<Star />}
                      iconPosition="start"
                      label={t('orders.ratings', 'Ratings')}
                    />
                  </Tabs>
                </Box>

                {/* Tab 0: Order Details */}
                {activeTab === 0 && (
                  <CardContent sx={{ p: 3 }}>
                    {/* Order Items */}
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {t('orders.orderItems', 'Order Items')}
                      </Typography>
                      <Stack spacing={2}>
                        {order.order_items?.map((item) => (
                          <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              {item.item?.item_images?.[0]?.image_url && (
                                <Box
                                  component="img"
                                  src={item.item.item_images[0].image_url}
                                  alt={item.item.name}
                                  sx={{
                                    width: 80,
                                    height: 80,
                                    objectFit: 'cover',
                                    borderRadius: 1,
                                  }}
                                />
                              )}
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant="subtitle1"
                                  fontWeight="medium"
                                >
                                  {item.item?.name}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {t('orders.quantity', 'Quantity')}:{' '}
                                  {item.quantity}
                                </Typography>
                                <Typography
                                  variant="h6"
                                  color="primary"
                                  sx={{ mt: 1 }}
                                >
                                  {item.unit_price !== undefined &&
                                    formatCurrency(
                                      item.unit_price * item.quantity,
                                      order.currency
                                    )}
                                </Typography>
                              </Box>
                            </Box>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>

                    {/* Business Info */}
                    {order.business && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {t('orders.businessInfo', 'Business Information')}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 56,
                                height: 56,
                                bgcolor: 'primary.main',
                              }}
                            >
                              <BusinessIcon />
                            </Avatar>
                            <Box>
                              <Typography
                                variant="subtitle1"
                                fontWeight="medium"
                              >
                                {order.business.name}
                              </Typography>
                              {order.business.user?.phone_number && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    mt: 0.5,
                                  }}
                                >
                                  <Phone fontSize="small" color="action" />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {order.business.user.phone_number}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      </Box>
                    )}

                    {/* Client Info */}
                    {order.client && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {t('orders.clientInfo', 'Client Information')}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 56,
                                height: 56,
                                bgcolor: 'secondary.main',
                              }}
                            >
                              <ShoppingBag />
                            </Avatar>
                            <Box>
                              <Typography
                                variant="subtitle1"
                                fontWeight="medium"
                              >
                                {order.client.user.first_name}{' '}
                                {order.client.user.last_name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.5 }}
                              >
                                {order.client.user.email}
                              </Typography>
                              {profile?.agent?.id &&
                                order.assigned_agent_id &&
                                order.assigned_agent_id === profile.agent.id &&
                                order.client.user.phone_number && (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                      mt: 0.5,
                                    }}
                                  >
                                    <Phone fontSize="small" color="action" />
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      {order.client.user.phone_number}
                                    </Typography>
                                  </Box>
                                )}
                            </Box>
                          </Box>
                        </Paper>
                      </Box>
                    )}
                  </CardContent>
                )}

                {/* Tab 1: Delivery Info */}
                {activeTab === 1 && (
                  <CardContent sx={{ p: 3 }}>
                    {/* Pickup Location */}
                    {order.business_location && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {t('orders.pickupLocation', 'Pickup Location')}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <LocationOn color="primary" />
                            <Box sx={{ flex: 1 }}>
                              <Typography
                                variant="subtitle2"
                                fontWeight="medium"
                                gutterBottom
                              >
                                {order.business_location.name}
                              </Typography>
                              <Typography variant="body1">
                                {formatAddress(order.business_location.address)}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Box>
                    )}

                    {/* Delivery Address */}
                    {order.delivery_address && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {t('orders.deliveryAddress', 'Delivery Address')}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <LocationOn color="secondary" />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body1" component="div">
                                {formatAddress(order.delivery_address)}
                                {profile?.agent?.id &&
                                  order.assigned_agent_id &&
                                  order.assigned_agent_id ===
                                    profile.agent.id &&
                                  order.client?.user?.phone_number && (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        mt: 1,
                                      }}
                                    >
                                      <Phone fontSize="small" color="action" />
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        {order.client.user.phone_number}
                                      </Typography>
                                    </Box>
                                  )}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Box>
                    )}

                    {/* Delivery Information */}
                    {(order.preferred_delivery_time ||
                      order.requires_fast_delivery ||
                      order.special_instructions ||
                      order.estimated_delivery_time ||
                      order.actual_delivery_time) && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {t('orders.deliveryInfo', 'Delivery Information')}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={2}>
                            {/* Preferred Delivery Time */}
                            {order.preferred_delivery_time && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 2,
                                  alignItems: 'center',
                                }}
                              >
                                <Event color="primary" />
                                <Box>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {t(
                                      'orders.preferredDeliveryTime',
                                      'Preferred Delivery Time'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body1"
                                    fontWeight="medium"
                                  >
                                    {new Date(
                                      order.preferred_delivery_time
                                    ).toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            )}

                            {/* Fast Delivery */}
                            {order.requires_fast_delivery && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 2,
                                  alignItems: 'center',
                                }}
                              >
                                <LocalShipping color="primary" />
                                <Box sx={{ flex: 1 }}>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {t(
                                      'orders.fastDelivery.title',
                                      'Fast Delivery'
                                    )}
                                  </Typography>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <Chip
                                      label={t(
                                        'orders.fastDelivery.enabled',
                                        'Enabled'
                                      )}
                                      color="primary"
                                      size="small"
                                    />
                                    <Typography
                                      variant="body1"
                                      fontWeight="medium"
                                      color="primary"
                                    >
                                      {order.base_delivery_fee !== undefined &&
                                        formatCurrency(
                                          order.base_delivery_fee,
                                          order.currency
                                        )}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            )}

                            {/* Special Instructions */}
                            {order.special_instructions && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 2,
                                  alignItems: 'flex-start',
                                }}
                              >
                                <Receipt color="primary" />
                                <Box>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {t(
                                      'orders.specialInstructions',
                                      'Special Instructions'
                                    )}
                                  </Typography>
                                  <Typography variant="body1">
                                    {order.special_instructions}
                                  </Typography>
                                </Box>
                              </Box>
                            )}

                            {/* Estimated Delivery Time */}
                            {order.estimated_delivery_time && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 2,
                                  alignItems: 'center',
                                }}
                              >
                                <Event color="primary" />
                                <Box>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {t(
                                      'orders.estimatedDeliveryTime',
                                      'Estimated Delivery Time'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body1"
                                    fontWeight="medium"
                                  >
                                    {new Date(
                                      order.estimated_delivery_time
                                    ).toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            )}

                            {/* Actual Delivery Time */}
                            {order.actual_delivery_time && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 2,
                                  alignItems: 'center',
                                }}
                              >
                                <CheckCircle color="success" />
                                <Box>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {t(
                                      'orders.actualDeliveryTime',
                                      'Actual Delivery Time'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body1"
                                    fontWeight="medium"
                                    color="success.main"
                                  >
                                    {new Date(
                                      order.actual_delivery_time
                                    ).toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Stack>
                        </Paper>
                      </Box>
                    )}

                    {/* Delivery Time Window */}
                    <Box sx={{ mb: 4 }}>
                      <DeliveryTimeWindowDisplay order={order} />
                    </Box>

                    {/* Agent Info */}
                    {order.assigned_agent && (
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {t('orders.deliveryAgent', 'Delivery Agent')}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 56,
                                height: 56,
                                bgcolor: 'info.main',
                              }}
                            >
                              <LocalShipping />
                            </Avatar>
                            <Box>
                              <Typography
                                variant="subtitle1"
                                fontWeight="medium"
                              >
                                {order.assigned_agent.user.first_name}{' '}
                                {order.assigned_agent.user.last_name}
                              </Typography>
                              {order.assigned_agent.user.phone_number && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    mt: 0.5,
                                  }}
                                >
                                  <Phone fontSize="small" color="action" />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {order.assigned_agent.user.phone_number}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      </Box>
                    )}

                    {!order.assigned_agent && (
                      <Alert severity="info">
                        {t(
                          'orders.noAgentAssigned',
                          'No delivery agent assigned yet'
                        )}
                      </Alert>
                    )}
                  </CardContent>
                )}

                {/* Tab 2: Ratings */}
                {activeTab === 2 && (
                  <CardContent sx={{ p: 3 }}>
                    <OrderRatingsDisplay
                      ratings={ratings}
                      userType={
                        profile?.user_type_id as 'client' | 'agent' | 'business'
                      }
                    />
                    {ratings.length === 0 && (
                      <Alert severity="info">
                        {t('orders.noRatingsYet', 'No ratings yet')}
                      </Alert>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Messages Section */}
              {(!profile?.agent ||
                order.assigned_agent_id === profile?.agent?.id) && (
                <Card>
                  <CardContent sx={{ p: 3 }}>
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
            </Grid>

            {/* Right Column - Order Summary & Actions */}
            <Grid size={{ xs: 12, md: 4 }}>
              {/* Order Summary Card */}
              <Card
                sx={{
                  mb: 3,
                  position: { xs: 'static', md: 'sticky' },
                  top: { md: 90 },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {t('orders.orderSummary', 'Order Summary')}
                  </Typography>
                  <Divider sx={{ my: 2 }} />

                  {/* Order Date */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Event fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {t('orders.orderDate', 'Order Date')}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="medium">
                      {formatDate(order.created_at)}
                    </Typography>
                  </Box>

                  {/* Payment Status */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Payment fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {t('orders.paymentStatus', 'Payment')}
                      </Typography>
                    </Box>
                    <Chip
                      label={order.payment_status || 'Pending'}
                      size="small"
                      color={
                        order.payment_status === 'paid' ? 'success' : 'warning'
                      }
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Price Breakdown */}
                  <Box sx={{ mb: 2 }}>
                    {profile?.agent ? (
                      // Agent view: Show only delivery commission
                      order.delivery_commission !== undefined && (
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 1,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {t(
                              'orders.deliveryCommission',
                              'Delivery Commission'
                            )}
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color="primary"
                          >
                            {formatCurrency(
                              order.delivery_commission,
                              order.currency
                            )}
                          </Typography>
                        </Box>
                      )
                    ) : (
                      // Business/Client view: Show full breakdown
                      <>
                        {order.subtotal !== undefined && (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              mb: 1,
                            }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              {t('orders.subtotal', 'Subtotal')}
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrency(order.subtotal, order.currency)}
                            </Typography>
                          </Box>
                        )}
                        {(order.base_delivery_fee !== undefined ||
                          order.per_km_delivery_fee !== undefined) && (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              mb: 1,
                            }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              {t('orders.deliveryFee', 'Delivery Fee')}
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrency(
                                (order.base_delivery_fee || 0) +
                                  (order.per_km_delivery_fee || 0),
                                order.currency
                              )}
                            </Typography>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {!profile?.agent &&
                    order.subtotal !== undefined &&
                    (order.base_delivery_fee !== undefined ||
                      order.per_km_delivery_fee !== undefined) && (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          mb: 3,
                        }}
                      >
                        <Typography variant="h6" fontWeight="bold">
                          {t('orders.total', 'Total')}
                        </Typography>
                        <Typography
                          variant="h6"
                          fontWeight="bold"
                          color="primary"
                        >
                          {formatCurrency(
                            order.subtotal +
                              (order.base_delivery_fee || 0) +
                              (order.per_km_delivery_fee || 0),
                            order.currency
                          )}
                        </Typography>
                      </Box>
                    )}

                  <Divider sx={{ mb: 3 }} />

                  {/* Action Buttons */}
                  <Stack spacing={2}>
                    {/* Persona-specific actions */}
                    {profile?.agent && (
                      <>
                        {order.current_status === 'ready_for_pickup' && (
                          <Alert severity="info" icon={<RefreshIcon />}>
                            <Typography variant="body2">
                              {t(
                                'orders.refreshAfterHoldPayment',
                                'If you have confirmed the hold payment, please refresh the page using the refresh button at the top to update your account balance.'
                              )}
                            </Typography>
                          </Alert>
                        )}
                        {/* Hide agent actions on mobile - they're shown in sticky bottom bar */}
                        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                          <AgentActions
                            order={order}
                            agentAccounts={accounts}
                            onActionComplete={() => refetch()}
                            onShowNotification={handleShowNotification}
                          />
                        </Box>
                      </>
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

                    {/* Rating button */}
                    {order.current_status === 'complete' &&
                      profile?.user_type_id !== 'business' &&
                      ratings.length === 0 && (
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<Star />}
                          onClick={() => setRatingDialogOpen(true)}
                          fullWidth
                        >
                          {t('orders.actions.rateOrder', 'Rate Order')}
                        </Button>
                      )}

                    {/* History button */}
                    <Button
                      variant="outlined"
                      startIcon={<HistoryIcon />}
                      onClick={() => setHistoryDialogOpen(true)}
                      fullWidth
                    >
                      {t('orders.actions.viewHistory', 'View History')}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>

        {/* Mobile Sticky Action Bar for Agents */}
        {profile?.agent && isMobile && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 64, // Position above bottom nav (64px height)
              left: 0,
              right: 0,
              zIndex: 1100, // Above bottom nav (1000) but below modals
              display: { xs: 'block', md: 'none' },
              maxHeight: '50vh',
              overflowY: 'auto',
              pointerEvents: 'none', // Allow clicks to pass through container
            }}
          >
            <Box
              sx={{
                p: 2,
                pointerEvents: 'auto', // Re-enable clicks on content
              }}
            >
              <AgentActions
                order={order}
                agentAccounts={accounts}
                onActionComplete={() => refetch()}
                onShowNotification={handleShowNotification}
                mobileView={true}
              />
            </Box>
          </Box>
        )}
      </Box>

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
        onRatingSubmitted={() => {
          // Refresh the ratings data
          refetchRatings();
        }}
      />
    </>
  );
};

export default ManageOrderPage;
