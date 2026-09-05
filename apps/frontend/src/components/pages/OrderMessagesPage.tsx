import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Container,
  IconButton,
  Skeleton,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useOrdersApiPrefix } from '../../contexts/OrdersApiPrefixContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useOrderById } from '../../hooks/useOrderById';
import UserMessagesComponent from '../common/UserMessagesComponent';
import SEOHead from '../seo/SEOHead';
import {
  canSeeOrderMessages,
  resolveDelegateMessagesRedirect,
} from '../../utils/orderMessagesAccess';

function emptyPromptForPersona(
  t: (key: string, defaultValue: string) => string,
  persona: string | null | undefined
): string {
  if (persona === 'business') {
    return t(
      'messages.emptyPromptBusiness',
      'Message the customer or delivery agent about this order.'
    );
  }
  if (persona === 'agent') {
    return t(
      'messages.emptyPromptAgent',
      'Message the customer or store about this delivery.'
    );
  }
  return t(
    'messages.emptyPromptClient',
    'Message the store or delivery agent about this order.'
  );
}

/** Redirect delegates off owner /orders/:id/messages onto the delegate path. */
const OrderMessagesPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const ordersApiPrefix = useOrdersApiPrefix();
  const { isDelegationContext } = useUserProfileContext();

  const delegateRedirect = resolveDelegateMessagesRedirect({
    isDelegationContext,
    ordersApiPrefix,
    orderId,
    search: location.search,
  });
  if (delegateRedirect) {
    return <Navigate to={delegateRedirect} replace />;
  }

  return <OrderMessagesPageContent />;
};

const OrderMessagesPageContent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const draft = searchParams.get('draft');
  const { profile, userType: activePersona, isDelegationContext } =
    useUserProfileContext();
  const persona = isDelegationContext ? 'business' : activePersona;
  const orderBasePath = isDelegationContext
    ? `/delegate/orders/${orderId}`
    : `/orders/${orderId}`;

  const { order, loading, error, fetchOrder } = useOrderById();

  useEffect(() => {
    if (orderId) void fetchOrder(orderId);
  }, [orderId, fetchOrder]);

  const canSeeMessages = canSeeOrderMessages({
    persona,
    agentId: profile?.agent?.id,
    assignedAgentId: order?.assigned_agent_id,
  });

  if (loading && !order) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={48} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 2 }} />
      </Container>
    );
  }

  if (error || !order || !orderId) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography color="error">
          {error || t('orders.notFound', 'Order not found')}
        </Typography>
      </Container>
    );
  }

  if (!canSeeMessages) {
    return <Navigate to={orderBasePath} replace />;
  }

  return (
    <>
      <SEOHead
        title={t('messages.orderMessagesPageTitle', 'Messages · Order #{{orderNumber}}', {
          orderNumber: order.order_number,
        })}
      />
      <Container
        maxWidth="md"
        sx={{
          py: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: { xs: 'calc(100vh - 120px)', md: 'calc(100vh - 160px)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton
            onClick={() => navigate(orderBasePath)}
            aria-label={t('common.back', 'Back')}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} noWrap>
              {t('messages.orderMessages', 'Order Messages')}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {t('orders.orderNumber', 'Order #{{orderNumber}}', {
                orderNumber: order.order_number,
              })}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <UserMessagesComponent
            entityType="order"
            entityId={order.id}
            variant="page"
            highlightMessageId={highlight}
            initialDraft={draft}
            emptyPrompt={emptyPromptForPersona(t, persona)}
          />
        </Box>
      </Container>
    </>
  );
};

export default OrderMessagesPage;
