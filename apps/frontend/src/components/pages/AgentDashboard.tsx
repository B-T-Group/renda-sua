import { Assignment } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAgentEarningsSummary } from '../../hooks/useAgentEarningsSummary';
import { useAgentOrders } from '../../hooks/useAgentOrders';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import AgentEarningsWidget from '../common/AgentEarningsWidget';
import AgentQuickStats from '../common/AgentQuickStats';
import AgentReferralCodeCard from '../common/AgentReferralCodeCard';
import { ReferredBusinessesList } from '../referrals/ReferredBusinessesList';
import { MobilePaymentPhoneVerifyModal } from '../dialogs/MobilePaymentPhoneVerifyModal';
import { useAgentFocus } from '../../hooks/useAgentFocus';
import { useReferredBusinesses } from '../../hooks/useReferredBusinesses';
import OpenOrdersPage from './OpenOrdersPage';

const ORDER_STATUS_BOX_COLORS: Record<string, string> = {
  pending: '#fff3e0',
  pending_payment: '#fff8e1',
  confirmed: '#e3f2fd',
  preparing: '#e3f2fd',
  ready_for_pickup: '#e8eaf6',
  assigned_to_agent: '#e8eaf6',
  picked_up: '#e1f5fe',
  in_transit: '#e1f5fe',
  out_for_delivery: '#e0f7fa',
  delivered: '#e8f5e9',
  complete: '#e8f5e9',
  completed: '#e8f5e9',
};

const getOrderStatusBoxColor = (status: string): string =>
  ORDER_STATUS_BOX_COLORS[status] ?? '#f5f5f5';

/**
 * AgentDashboard component that shows available orders for agents to claim,
 * today's earnings, and quick stats.
 * Note: Agent onboarding is handled globally in App.tsx
 */
const AgentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { isStripeRail } = useIsStripeRail();
  const { hasVerifiedPhone, phones, fetchPhones } = useMobilePaymentPhones(
    !isStripeRail && !!profile?.agent
  );
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const agentCode = profile?.agent?.agent_code || '';
  const { showDelivery, showCommercial } = useAgentFocus();
  const { summary, loading, error } = useAgentEarningsSummary(true);
  const { orders, loading: ordersLoading } = useAgentOrders();
  const {
    businesses,
    loading: referredLoading,
    error: referredError,
  } = useReferredBusinesses('agent', showCommercial);

  const orderCountByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    orders
      .filter((o) => o.current_status !== 'cancelled')
      .forEach((o) => {
        counts[o.current_status] = (counts[o.current_status] ?? 0) + 1;
      });
    return counts;
  }, [orders]);

  const ordersTotalNonCancelled = useMemo(
    () => orders.filter((o) => o.current_status !== 'cancelled').length,
    [orders]
  );

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 1.5, width: '100%' }}>
        {!isStripeRail && profile?.agent && !hasVerifiedPhone ? (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => setPhoneModalOpen(true)}>
                {t('mobilePaymentPhone.verifyCta', 'Verify mobile money number')}
              </Button>
            }
          >
            {t(
              'mobilePaymentPhone.agentDashboardCta',
              'Verify your mobile money number to receive commission payouts.'
            )}
          </Alert>
        ) : null}
        <Grid container spacing={1.5} sx={{ width: '100%' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <AgentEarningsWidget summary={summary} loading={loading} error={error} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <AgentQuickStats summary={summary} loading={loading} error={error} />
          </Grid>
          {showDelivery ? (
          <Grid size={{ xs: 12 }}>
            <Card
              variant="outlined"
              sx={{
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => navigate('/orders')}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Assignment color="primary" />
                  <Typography variant="subtitle1" fontWeight="600">
                    {t('common.orders', 'Orders')}
                  </Typography>
                </Box>
                {ordersLoading ? (
                  <Skeleton variant="text" width={80} height={32} />
                ) : (
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {ordersTotalNonCancelled}
                  </Typography>
                )}
                {!ordersLoading && Object.keys(orderCountByStatus).length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                    {Object.entries(orderCountByStatus)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([status, n]) => (
                        <Box
                          key={status}
                          sx={{
                            bgcolor: getOrderStatusBoxColor(status),
                            color: 'text.primary',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          {t(`common.orderStatus.${status}`, status)}: {n}
                        </Box>
                      ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          ) : null}
          {showCommercial && agentCode ? (
            <Grid size={{ xs: 12 }}>
              <AgentReferralCodeCard agentCode={agentCode} />
            </Grid>
          ) : null}
          {showCommercial ? (
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    {t('referrals.followUp.listTitle', 'Referred businesses')}
                  </Typography>
                  <ReferredBusinessesList
                    businesses={businesses}
                    loading={referredLoading}
                    error={referredError}
                  />
                </CardContent>
              </Card>
            </Grid>
          ) : null}
        </Grid>
      </Container>
      <MobilePaymentPhoneVerifyModal
        open={phoneModalOpen}
        mode={phones[0] ? 'verify' : 'add'}
        initialPhone={phones[0] ?? null}
        attachAgentOnSuccess
        onClose={() => setPhoneModalOpen(false)}
        onCompleted={() => {
          void fetchPhones();
          setPhoneModalOpen(false);
        }}
      />
      {showDelivery ? <OpenOrdersPage /> : null}
    </>
  );
};

export default AgentDashboard;
