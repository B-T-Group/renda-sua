import { TrendingUp } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { Order } from '../../hooks/useAgentOrders';

interface AgentOrderAlertsProps {
  order: Order;
}

const AgentOrderAlerts: React.FC<AgentOrderAlertsProps> = ({ order }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { profile } = useUserProfileContext();

  const agentInternal = profile?.agent?.is_internal || false;

  const getDeliveryFee = () => {
    // Use delivery_commission from order (computed field for agents)
    return order.delivery_commission || 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: order.currency || 'USD',
    }).format(amount);
  };

  const getAlertsForStatus = () => {
    const alerts = [];

    switch (order.current_status) {
      case 'pending':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.pendingNotice',
            'This order is waiting for business confirmation. You cannot claim it yet.'
          ),
        });
        break;

      case 'confirmed':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.confirmedNotice',
            'Order confirmed by business and is being prepared. It will be available for pickup soon.'
          ),
        });
        break;

      case 'preparing':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.preparingNotice',
            'Business is currently preparing this order. It will be ready for pickup shortly.'
          ),
        });
        break;

      case 'ready_for_pickup':
        // Check if already assigned to this agent
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.assignedToYou',
              `Great! You've claimed this order. Earn ${formatCurrency(
                getDeliveryFee()
              )} by completing the delivery. Pick up from the business and deliver to the customer.`
            ),
          });
        } else if (order.assigned_agent_id) {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.assignedToOther',
              'This order has been claimed by another agent and is no longer available.'
            ),
          });
        } else {
          // Available for claiming
          if (order.verified_agent_delivery && !agentInternal) {
            alerts.push({
              severity: 'warning' as const,
              message: t(
                'agent.orders.internalRequired',
                'This order requires an internal agent. Contact support to become an internal agent.'
              ),
            });
          } else {
            // Store delivery fee for prominent display
            const deliveryFee = getDeliveryFee();
            alerts.push({
              severity: 'success' as const,
              message: t(
                'agent.orders.canClaim',
                '🚀 Perfect opportunity! Claim this order and earn {{deliveryFee}} for the delivery.',
                { deliveryFee: formatCurrency(deliveryFee) }
              ),
              showEarnings: true, // Flag to show earnings prominently
              deliveryFee: deliveryFee, // Store for display
            });
          }
        }
        break;

      case 'picked_up':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'agent.orders.pickedUpByYou',
              `You've picked up this order. Deliver it promptly to earn your ${formatCurrency(
                getDeliveryFee()
              )} delivery fee. Keep the customer informed of your progress.`,
              {
                deliveryFee: formatCurrency(getDeliveryFee()),
              }
            ),
          });
        } else {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.pickedUpByOther',
              'This order has been picked up by the assigned agent and is on its way to the customer.'
            ),
          });
        }
        break;

      case 'in_transit':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'agent.orders.inTransitByYou',
              `Order in transit. You're almost there! Complete the delivery to earn ${formatCurrency(
                getDeliveryFee()
              )}. Update the customer on your ETA.`,
              {
                deliveryFee: formatCurrency(getDeliveryFee()),
              }
            ),
          });
        } else {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.inTransitByOther',
              'Order is currently being delivered by the assigned agent.'
            ),
          });
        }
        break;

      case 'out_for_delivery':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'agent.orders.outForDeliveryByYou',
              `Final step! You're out for delivery. Complete this delivery to earn ${formatCurrency(
                getDeliveryFee()
              )}. Make sure to get confirmation from the customer.`,
              {
                deliveryFee: formatCurrency(getDeliveryFee()),
              }
            ),
          });
        } else {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.outForDeliveryByOther',
              'Order is out for delivery and should reach the customer soon.'
            ),
          });
        }
        break;

      case 'delivered':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.deliveredByYou',
              `🎉 Excellent work! You've successfully delivered this order and earned ${formatCurrency(
                getDeliveryFee()
              )}. Payment will be processed shortly.`,
              {
                deliveryFee: formatCurrency(getDeliveryFee()),
              }
            ),
          });
        } else {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.deliveredByOther',
              'Order has been successfully delivered to the customer.'
            ),
          });
        }
        break;

      case 'completed':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.completedByYou',
              `✅ Order completed! Your ${formatCurrency(
                getDeliveryFee()
              )} delivery payment has been processed. Thank you for your excellent service!`,
              {
                deliveryFee: formatCurrency(getDeliveryFee()),
              }
            ),
          });
        } else {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.completedByOther',
              'Order has been completed successfully.'
            ),
          });
        }
        break;

      case 'cancelled':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'agent.orders.cancelledNotice',
            'This order has been cancelled and is no longer available for delivery.'
          ),
        });
        break;

      case 'failed':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'error' as const,
            message: t(
              'agent.orders.failedByYou',
              'Delivery failed. Please contact support immediately to resolve this issue and avoid penalties.'
            ),
          });
        } else {
          alerts.push({
            severity: 'error' as const,
            message: t(
              'agent.orders.failedByOther',
              'This delivery failed. A new agent may be assigned to retry the delivery.'
            ),
          });
        }
        break;

      default:
        // No specific alerts for other statuses
        break;
    }

    return alerts;
  };

  const alerts = getAlertsForStatus();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      {alerts.map((alert, index) => {
        const showEarnings = (alert as any).showEarnings;
        const deliveryFee = (alert as any).deliveryFee;

        return (
          <Box key={index} sx={{ mb: index < alerts.length - 1 ? 2 : 0 }}>
            {showEarnings && deliveryFee !== undefined ? (
              <Card
                elevation={0}
                sx={{
                  bgcolor: 'background.paper',
                  border: `1px solid ${theme.palette.divider}`,
                  borderLeft: `4px solid ${theme.palette.success.main}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: theme.shadows[2],
                    borderLeftWidth: '6px',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={3}>
                    {/* Header Section */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: 'success.light',
                            color: 'success.main',
                          }}
                        >
                          <TrendingUp sx={{ fontSize: 20 }} />
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            {t(
                              'agent.orders.earningsOpportunity',
                              'Earn from this delivery'
                            )}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.25 }}
                          >
                            {t(
                              'agent.orders.canClaim',
                              'Perfect opportunity! Claim this order and earn {{deliveryFee}} for the delivery.',
                              { deliveryFee: formatCurrency(deliveryFee) }
                            )
                              .replace(/🚀/g, '')
                              .trim()}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Divider />

                    {/* Earnings Display */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 2,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
                        >
                          {t('agent.orders.deliveryEarnings', 'Delivery Fee')}
                        </Typography>
                      </Box>
                      <Typography
                        variant="h4"
                        fontWeight={700}
                        color="success.main"
                        sx={{
                          fontSize: { xs: '1.75rem', md: '2.25rem' },
                          lineHeight: 1.2,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {formatCurrency(deliveryFee)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Alert
                severity={alert.severity}
                variant="outlined"
                sx={{ mb: 0 }}
              >
                {alert.message}
              </Alert>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default AgentOrderAlerts;
