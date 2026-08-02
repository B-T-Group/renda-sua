import { Alert, AlertTitle, Box, Button, Stack } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderPickupOps } from '../../hooks/useOrderPickupOps';

interface PickupSlaBannerProps {
  orderId: string;
  pickupState?: string | null;
  pickupDueAt?: string | null;
  pickupPausedAt?: string | null;
  onUpdated?: () => void;
  /** When true, show business "need more time" action */
  showMerchantAction?: boolean;
}

export const PickupSlaBanner: React.FC<PickupSlaBannerProps> = ({
  orderId,
  pickupState,
  pickupDueAt,
  pickupPausedAt,
  onUpdated,
  showMerchantAction = false,
}) => {
  const { t } = useTranslation();
  const { markPickupNotReady, resumePickupMonitoring, loading } =
    useOrderPickupOps();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleResume = async () => {
    setLocalError(null);
    try {
      await resumePickupMonitoring(orderId);
      onUpdated?.();
    } catch (err: any) {
      setLocalError(err?.message || 'Failed');
    }
  };

  if (!pickupState || pickupState === 'recovered') return null;
  if (pickupPausedAt || pickupState === 'paused') {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>
          {t('orders.pickupSla.pausedTitle', 'Pickup monitoring paused')}
        </AlertTitle>
        <Stack spacing={1}>
          <Box>
            {t(
              'orders.pickupSla.pausedBody',
              'The pickup timer is paused while the order is not ready.'
            )}
          </Box>
          {localError && (
            <Box sx={{ color: 'error.main', typography: 'caption' }}>
              {localError}
            </Box>
          )}
          {showMerchantAction && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                disabled={loading}
                onClick={() => void handleResume()}
              >
                {t('orders.pickupSla.resume', 'Resume pickup timer')}
              </Button>
            </Box>
          )}
        </Stack>
      </Alert>
    );
  }

  const severity =
    pickupState === 'overdue'
      ? 'error'
      : pickupState === 'at_risk'
        ? 'warning'
        : 'info';

  const title =
    pickupState === 'overdue'
      ? t('orders.pickupSla.overdueTitle', 'Pickup overdue')
      : pickupState === 'at_risk'
        ? t('orders.pickupSla.atRiskTitle', 'Agent running late')
        : t('orders.pickupSla.monitoringTitle', 'Pickup in progress');

  const body =
    pickupState === 'overdue'
      ? t(
          'orders.pickupSla.overdueBody',
          'The assigned agent has not picked up this order yet. A reassignment may follow.'
        )
      : pickupState === 'at_risk'
        ? t(
            'orders.pickupSla.atRiskBody',
            'Your assigned agent is running late. We are monitoring and will find another agent if needed.'
          )
        : t(
            'orders.pickupSla.monitoringBody',
            'An agent is assigned and heading to pick up this order.'
          );

  const handleNeedMoreTime = async () => {
    setLocalError(null);
    try {
      await markPickupNotReady(orderId, 15);
      onUpdated?.();
    } catch (err: any) {
      setLocalError(err?.message || 'Failed');
    }
  };

  return (
    <Alert severity={severity} sx={{ mb: 2 }}>
      <AlertTitle>{title}</AlertTitle>
      <Stack spacing={1}>
        <Box>{body}</Box>
        {pickupDueAt && (
          <Box sx={{ typography: 'caption' }}>
            {t('orders.pickupSla.dueAt', 'Pickup due by {{time}}', {
              time: new Date(pickupDueAt).toLocaleString(),
            })}
          </Box>
        )}
        {localError && (
          <Box sx={{ color: 'error.main', typography: 'caption' }}>
            {localError}
          </Box>
        )}
        {showMerchantAction &&
          ['monitoring', 'reminded', 'at_risk', 'overdue'].includes(
            pickupState
          ) && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                disabled={loading}
                onClick={() => void handleNeedMoreTime()}
              >
                {t('orders.pickupSla.needMoreTime', 'Need more time')}
              </Button>
            </Box>
          )}
      </Stack>
    </Alert>
  );
};
