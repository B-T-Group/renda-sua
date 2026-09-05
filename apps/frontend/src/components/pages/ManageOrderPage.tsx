import { ArrowBack as ArrowBackIcon, History as HistoryIcon, Message as MessageIcon, Star, Support as SupportIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useOrdersApiPrefix } from '../../contexts/OrdersApiPrefixContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo, useBackendOrders } from '../../hooks';
import { useApiClient } from '../../hooks/useApiClient';
import { useOrderById } from '../../hooks/useOrderById';
import { useOrderSubscription } from '../../hooks/useOrderSubscription';
import { useOrderRatings } from '../../hooks/useOrderRatings';
import { useOrderRatingEligibility } from '../../hooks/useOrderRatingEligibility';
import { useOrderRefunds, type RefundRequestDetail } from '../../hooks/useOrderRefunds';
import { useStripeConnect } from '../../hooks/useStripeConnect';
import ConfirmationModal from '../common/ConfirmationModal';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';
import DeliveryTrackingMap from '../delivery/DeliveryTrackingMap';
import OrderRatingsDisplay from '../common/OrderRatingsDisplay';
import OrderHistoryDialog from '../dialogs/OrderHistoryDialog';
import { OrderEventsTimeline } from '../orders/OrderEventsTimeline';
import RatingDialog, { type RatingDialogMode } from '../dialogs/RatingDialog';
import ReportIssueDialog from '../dialogs/ReportIssueDialog';
import AgentOrderAlerts from '../orders/AgentOrderAlerts';
import BusinessOrderAlerts from '../orders/BusinessOrderAlerts';
import ClientOrderAlerts from '../orders/ClientOrderAlerts';
import BusinessOrderActions from '../orders/business/BusinessOrderActions';
import ClientOrderActions from '../orders/client/ClientOrderActions';
import DeliveryOrderActions from '../orders/delivery/DeliveryOrderActions';
import { OrderPhaseBanner } from '../orders/OrderPhaseBanner';
import PersonaOrderDetails, {
  type OrderPersona,
} from '../orders/PersonaOrderDetails';
import {
  isRefundOrderStatus,
  RefundProgressCard,
} from '../orders/RefundProgressCard';
import {
  ORDER_PRIMARY_ACTION_LABEL,
  orderToPhaseInput,
  resolveOrderPhase,
} from '../../utils/orderPhase';
import { buildMomoAwaitingPaymentTo } from '../../utils/momoAwaitingPaymentNav';
import SEOHead from '../seo/SEOHead';

const CLIENT_TRACKING_STATUSES = ['picked_up', 'in_transit', 'out_for_delivery'];

const LoadingSkeleton = () => (
  <Container maxWidth="xl" sx={{ py: 4 }}>
    <Skeleton variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 2 }} />
    <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 2 }} />
    <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
  </Container>
);

function resolvePersona(activePersona?: string | null): OrderPersona {
  if (activePersona === 'business' || activePersona === 'agent') {
    return activePersona;
  }
  return 'client';
}

/** Redirect delegates off owner /orders/:id so hooks never call owner APIs. */
const ManageOrderPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const ordersApiPrefix = useOrdersApiPrefix();
  const { isDelegationContext } = useUserProfileContext();

  if (isDelegationContext && ordersApiPrefix !== '/delegate' && orderId) {
    return (
      <Navigate
        to={`/delegate/orders/${orderId}${location.search}`}
        replace
      />
    );
  }

  return <ManageOrderPageContent />;
};

const ManageOrderPageContent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { orderId } = useParams<{ orderId: string }>();
  const { profile, userType: activePersona, isDelegationContext } =
    useUserProfileContext();
  const persona = isDelegationContext
    ? 'business'
    : resolvePersona(activePersona);
  const ordersListPath = isDelegationContext ? '/delegate/orders' : '/orders';
  const api = useApiClient();
  const { accounts } = useAccountInfo();
  const { enqueueSnackbar } = useSnackbar();
  const {
    retryOrderPayment,
    loading: actionLoading,
  } = useBackendOrders();
  const { status: connectStatus } = useStripeConnect();
  const isStripeRail = connectStatus?.paymentRail === 'stripe';

  const { order, loading, error, fetchOrder, refetch } = useOrderById();
  const { ratings, refetch: refetchRatings } = useOrderRatings(orderId || '');
  const { eligibility, refetch: refetchEligibility } =
    useOrderRatingEligibility(
      orderId || '',
      order?.current_status === 'complete' && persona !== 'business'
    );
  const { isActive: orderSubscriptionActive } = useOrderSubscription({
    orderId: orderId ?? null,
    onOrderUpdate: refetch,
    enabled: Boolean(orderId),
  });
  const { getRefundRequest } = useOrderRefunds();

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [reportIssueDialogOpen, setReportIssueDialogOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [ratingDialogMode, setRatingDialogMode] =
    useState<RatingDialogMode | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationAlert, setNotificationAlert] = useState<{
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);
  const [refundDetail, setRefundDetail] = useState<RefundRequestDetail | null>(
    null
  );
  const [refundDetailLoading, setRefundDetailLoading] = useState(false);
  const [cancellingClaim, setCancellingClaim] = useState(false);

  useEffect(() => {
    if (orderId) {
      void fetchOrder(orderId);
    }
  }, [orderId, fetchOrder]);

  useEffect(() => {
    const rateParam = searchParams.get('rate');
    if (!rateParam || !eligibility) return;
    const eligibleByMode: Record<string, boolean> = {
      agent: eligibility.canRateAgent,
      item: eligibility.canRateItem,
      client: eligibility.canRateClient,
    };
    if (!eligibleByMode[rateParam]) return;
    setRatingDialogMode(rateParam as RatingDialogMode);
    searchParams.delete('rate');
    setSearchParams(searchParams, { replace: true });
  }, [eligibility, searchParams, setSearchParams]);

  // Legacy deep links: /orders/:id?messages=1 → dedicated messages page
  useEffect(() => {
    if (!orderId || searchParams.get('messages') !== '1') return;
    const highlight = searchParams.get('highlight');
    const base = isDelegationContext
      ? `/delegate/orders/${orderId}/messages`
      : `/orders/${orderId}/messages`;
    const qs = highlight ? `?highlight=${encodeURIComponent(highlight)}` : '';
    navigate(`${base}${qs}`, { replace: true });
  }, [orderId, searchParams, isDelegationContext, navigate]);

  useEffect(() => {
    if (!order || !isRefundOrderStatus(order.current_status)) {
      setRefundDetail(null);
      return;
    }
    let cancelled = false;
    setRefundDetailLoading(true);
    getRefundRequest(order.id)
      .then((data) => {
        if (cancelled) return;
        const req = data.refundRequest as RefundRequestDetail | null;
        setRefundDetail(
          req
            ? {
                ...req,
                timeline: data.timeline ?? req.timeline,
                payments: data.payments ?? req.payments,
                evidence: data.evidence ?? req.evidence,
                destination: req.destination ?? data.destination,
              }
            : null
        );
      })
      .catch(() => {
        if (!cancelled) setRefundDetail(null);
      })
      .finally(() => {
        if (!cancelled) setRefundDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.id, order?.current_status, getRefundRequest]);

  const handleShowNotification = (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => setNotificationAlert({ message, severity });

  if (loading && !order) return <LoadingSkeleton />;

  if (error || !order) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          {error || t('orders.notFound', 'Order not found')}
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate(ordersListPath)}>
          {t('common.back', 'Back')}
        </Button>
      </Container>
    );
  }

  const phaseInfo = resolveOrderPhase(orderToPhaseInput(order), persona);
  const [primaryLabelKey, primaryLabelDefault] =
    ORDER_PRIMARY_ACTION_LABEL[phaseInfo.primaryActionId];

  const handleRetryPayment = async () => {
    try {
      const isStripeOrder =
        order.payment_source === 'credit_card' || isStripeRail;
      const result = await retryOrderPayment(order.id);
      if (isStripeOrder && result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      if (!isStripeOrder) {
        navigate(
          buildMomoAwaitingPaymentTo({
            orderIds: [order.id],
            phoneE164: order.client?.user?.phone_number?.trim() || '',
            source: 'retry',
            orderNumbers: [order.order_number],
          })
        );
        return;
      }
      enqueueSnackbar(
        t(
          'orders.retryPayment.successStripe',
          'Opening secure card payment…'
        ),
        { variant: 'success' }
      );
      await refetch();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message || t('orders.retryPayment.error', 'Failed to retry payment'),
        { variant: 'error' }
      );
    }
  };

  const handlePrimaryPhaseAction = () => {
    if (phaseInfo.primaryActionId === 'pay') {
      void handleRetryPayment();
      return;
    }
    if (phaseInfo.primaryActionId === 'rate') {
      if (eligibility?.canRateAgent) setRatingDialogMode('agent');
      else if (eligibility?.canRateItem) setRatingDialogMode('item');
      else if (eligibility?.canRateClient) setRatingDialogMode('client');
    }
  };

  const showPayCta =
    phaseInfo.primaryActionId === 'pay' &&
    order.payment_timing === 'pay_now' &&
    order.payment_status !== 'paid';
  const canShowRatePrimary = !!(
    eligibility?.canRateAgent ||
    eligibility?.canRateItem ||
    eligibility?.canRateClient
  );
  const showRateCta =
    phaseInfo.primaryActionId === 'rate' && canShowRatePrimary;
  const itemRatingLocked =
    !!eligibility &&
    !eligibility.canRateItem &&
    !!eligibility.itemRatingUnlocksAt &&
    new Date(eligibility.itemRatingUnlocksAt) > new Date() &&
    eligibility.items.some((i) => !i.rated) &&
    !eligibility.canRateAgent &&
    !eligibility.canRateClient;
  const phaseBannerAction =
    persona === 'client' && showPayCta ? (
      <Button variant="contained" fullWidth onClick={handlePrimaryPhaseAction}>
        {t(primaryLabelKey, primaryLabelDefault)}
      </Button>
    ) : persona === 'client' && showRateCta ? (
      <Button variant="contained" fullWidth onClick={handlePrimaryPhaseAction}>
        {t(primaryLabelKey, primaryLabelDefault)}
      </Button>
    ) : persona === 'client' &&
      phaseInfo.primaryActionId === 'rate' &&
      itemRatingLocked &&
      eligibility?.itemRatingUnlocksAt ? (
      <Typography variant="body2" color="text.secondary">
        {t('orders.itemRatingUnlocksOn', {
          defaultValue: 'You can rate your items from {{date}}',
          date: new Date(eligibility.itemRatingUnlocksAt).toLocaleDateString(),
        })}
      </Typography>
    ) : null;

  const handleCancelOrder = () => {
    setCancelModalOpen(true);
  };

  const handleCancelSuccess = () => {
    enqueueSnackbar(
      t('messages.orderCancelSuccess', 'Order cancelled successfully'),
      { variant: 'success' }
    );
    void refetch();
  };

  const handleCancelError = (errorMessage: string) => {
    enqueueSnackbar(errorMessage, { variant: 'error' });
  };

  const handleCancelClaimRequest = async () => {
    if (!order) return;
    setCancellingClaim(true);
    try {
      const response = await api.post('/orders/cancel-claim-request', {
        orderId: order.id,
      });
      if (!response.data?.success) {
        throw new Error(
          response.data?.error ||
            response.data?.message ||
            t(
              'orders.claimPending.cancelRequestFailed',
              'Failed to cancel claim request'
            )
        );
      }
      enqueueSnackbar(
        t(
          'orders.claimPending.cancelRequestSuccess',
          'Claim request cancelled successfully'
        ),
        { variant: 'success' }
      );
      await refetch();
    } catch (e: any) {
      enqueueSnackbar(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          t(
            'orders.claimPending.cancelRequestFailed',
            'Failed to cancel claim request'
          ),
        { variant: 'error' }
      );
    } finally {
      setCancellingClaim(false);
    }
  };

  const canSeeMessages =
    persona !== 'agent' ||
    (Boolean(profile?.agent?.id) &&
      order.assigned_agent_id === profile?.agent?.id);

  const messagesPath = isDelegationContext
    ? `/delegate/orders/${order.id}/messages`
    : `/orders/${order.id}/messages`;

  const headerTrailing = canSeeMessages ? (
    <Button
      variant="contained"
      size="small"
      startIcon={<MessageIcon />}
      onClick={() => navigate(messagesPath)}
      sx={{
        fontWeight: 700,
        '@keyframes messagePulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        animation: 'messagePulse 1.8s ease-in-out infinite',
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    >
      {t('orders.actions.message', 'Message')}
    </Button>
  ) : null;

  const tracking =
    persona === 'client' &&
    CLIENT_TRACKING_STATUSES.includes(order.current_status) ? (
      <Box sx={{ mb: 3 }}>
        <DeliveryTrackingMap
          orderId={order.id}
          pickupAddress={order.business_location?.address}
          deliveryAddress={order.delivery_address ?? undefined}
        />
      </Box>
    ) : persona === 'agent' &&
      ['assigned_to_agent', 'picked_up', 'in_transit', 'out_for_delivery'].includes(
        order.current_status
      ) ? (
      <Box sx={{ mb: 3 }}>
        <DeliveryTrackingMap
          orderId={order.id}
          pickupAddress={order.business_location?.address}
          deliveryAddress={order.delivery_address ?? undefined}
        />
      </Box>
    ) : null;

  const alerts = (
    <>
      {notificationAlert && (
        <Alert
          severity={notificationAlert.severity}
          sx={{ mb: 2 }}
          onClose={() => setNotificationAlert(null)}
        >
          {notificationAlert.message}
        </Alert>
      )}
      {persona === 'agent' && <AgentOrderAlerts order={order as never} />}
      {persona === 'business' && (
        <BusinessOrderAlerts
          order={order as never}
          onCancelOrder={() => handleCancelOrder()}
          onOrderUpdated={() => void refetch()}
        />
      )}
      {persona === 'client' && <ClientOrderAlerts order={order as never} />}
      {isRefundOrderStatus(order.current_status) && (
        <RefundProgressCard
          orderStatus={order.current_status}
          detail={refundDetail}
          loading={refundDetailLoading}
        />
      )}
    </>
  );

  const extras = (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <OrderRatingsDisplay ratings={ratings} userType={persona} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {eligibility?.canRateAgent && (
          <Button
            variant="contained"
            startIcon={<Star />}
            onClick={() => setRatingDialogMode('agent')}
          >
            {t('orders.actions.rateAgent', 'Rate Delivery Agent')}
          </Button>
        )}
        {eligibility?.canRateItem && (
          <Button
            variant="contained"
            startIcon={<Star />}
            onClick={() => setRatingDialogMode('item')}
          >
            {t('orders.actions.rateItems', 'Rate Your Items')}
          </Button>
        )}
        {eligibility &&
          !eligibility.canRateItem &&
          persona === 'client' &&
          eligibility.itemRatingUnlocksAt &&
          new Date(eligibility.itemRatingUnlocksAt) > new Date() &&
          eligibility.items.some((i) => !i.rated) && (
            <Typography variant="caption" color="text.secondary">
              {t('orders.itemRatingUnlocksOn', {
                defaultValue: 'You can rate your items from {{date}}',
                date: new Date(
                  eligibility.itemRatingUnlocksAt
                ).toLocaleDateString(),
              })}
            </Typography>
          )}
        {eligibility?.canRateClient && (
          <Button
            variant="contained"
            startIcon={<Star />}
            onClick={() => setRatingDialogMode('client')}
          >
            {t('orders.actions.rateClient', 'Rate Client')}
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() => setHistoryDialogOpen(true)}
        >
          {t('orders.actions.viewHistory', 'View History')}
        </Button>
        {persona === 'client' &&
          ['delivered', 'failed', 'complete', 'refunded'].includes(
            order.current_status
          ) && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<SupportIcon />}
              onClick={() => setReportIssueDialogOpen(true)}
            >
              {t('support.reportIssue', 'Report an issue')}
            </Button>
          )}
      </Stack>
    </Stack>
  );

  return (
    <>
      <SEOHead
        title={t('orders.orderNumber', 'Order #{{orderNumber}}', {
          orderNumber: order.order_number,
        })}
      />
      <Box sx={{ pb: isMobile ? 'calc(64px + min(45vh, 280px))' : 0 }}>
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <IconButton onClick={() => navigate(ordersListPath)} aria-label="back">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {t('orders.placedOn', 'Placed on')}{' '}
              {new Date(order.created_at).toLocaleString()}
            </Typography>
          </Box>

          {(persona === 'client' ||
            persona === 'business' ||
            persona === 'agent') && (
            <OrderPhaseBanner
              order={order}
              role={persona}
              action={phaseBannerAction}
            />
          )}

          <PersonaOrderDetails
            persona={persona}
            order={order}
            live={orderSubscriptionActive}
            onRefresh={refetch}
            alerts={alerts}
            tracking={tracking}
            extras={extras}
            headerTrailing={headerTrailing}
            hideActions={isMobile}
            onActionComplete={() => refetch()}
            onShowNotification={handleShowNotification}
          />
        </Container>

        {isMobile && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 64,
              left: 0,
              right: 0,
              zIndex: 1100,
              maxHeight: '45vh',
              overflowY: 'auto',
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
              boxShadow: 3,
            }}
          >
            <Box sx={{ p: 2 }}>
              {persona === 'agent' ? (
                (order as { is_claim_pending?: boolean }).is_claim_pending ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    disabled={cancellingClaim}
                    onClick={() => void handleCancelClaimRequest()}
                    startIcon={
                      cancellingClaim ? (
                        <CircularProgress size={16} />
                      ) : undefined
                    }
                  >
                    {t(
                      'orders.claimPending.cancelRequest',
                      'Cancel claim request'
                    )}
                  </Button>
                ) : (
                  <DeliveryOrderActions
                    order={order}
                    agentAccounts={accounts}
                    onActionComplete={() => refetch()}
                    onShowNotification={handleShowNotification}
                    mobileView
                  />
                )
              ) : persona === 'business' ? (
                <BusinessOrderActions
                  order={order}
                  onActionComplete={() => refetch()}
                  onShowNotification={handleShowNotification}
                  onShowHistory={() => setHistoryDialogOpen(true)}
                />
              ) : (
                <ClientOrderActions
                  order={order}
                  onActionComplete={() => refetch()}
                  onShowNotification={handleShowNotification}
                  deliveryPinFullWidth
                />
              )}
            </Box>
          </Box>
        )}
      </Box>

      {order.current_status === 'assigned_to_agent' && (
        <OrderEventsTimeline orderId={order.id} />
      )}

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

      <ReportIssueDialog
        open={reportIssueDialogOpen}
        onClose={() => setReportIssueDialogOpen(false)}
        orderId={order.id}
        orderNumber={order.order_number}
        onSubmit={async (payload) => {
          await api.post('/support/tickets', payload);
          handleShowNotification(
            t(
              'support.ticketCreated',
              'Support ticket created. We will get back to you soon.'
            ),
            'success'
          );
        }}
      />

      <RatingDialog
        open={ratingDialogMode !== null}
        onClose={() => setRatingDialogMode(null)}
        orderId={order.id}
        orderNumber={order.order_number}
        mode={ratingDialogMode ?? 'agent'}
        eligibility={eligibility}
        onRatingSubmitted={() => {
          refetchRatings();
          refetchEligibility();
        }}
      />

      <CancellationReasonModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        persona={persona}
        onSuccess={handleCancelSuccess}
        onError={handleCancelError}
      />

      <ConfirmationModal
        open={false}
        title=""
        message=""
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </>
  );
};

export default ManageOrderPage;
