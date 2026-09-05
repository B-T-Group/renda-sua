import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CampaignIcon from '@mui/icons-material/Campaign';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KitchenIcon from '@mui/icons-material/Kitchen';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIncomingOrderInterrupt } from '../../hooks/useIncomingOrderInterrupt';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

function formatCurrency(amount = 0, currency = 'XAF'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCountdown(
  secondsLeft: number | null,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (secondsLeft == null) {
    return t('incomingOrder.awaitingAction', 'Awaiting action');
  }
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  if (minutes > 0) {
    return t('incomingOrder.timeLeft', '{{m}}m {{s}}s to accept', {
      m: minutes,
      s: seconds,
    });
  }
  return t('incomingOrder.secondsLeft', '{{seconds}}s to accept', {
    seconds: secondsLeft,
  });
}

function playBeep(context: AudioContext): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.32);
}

async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  try {
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    return wakeLock ? await wakeLock.request('screen') : null;
  } catch {
    return null;
  }
}

export function KitchenModePage() {
  const { t } = useTranslation();
  const interrupt = useIncomingOrderInterrupt();
  const [isArmed, setIsArmed] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const order = interrupt.order;
  const isWorking =
    interrupt.uiState === 'confirming' || interrupt.uiState === 'busy';
  const customerName = useMemo(
    () =>
      [order?.client?.user?.first_name, order?.client?.user?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim(),
    [order]
  );

  const stopBeeping = useCallback(() => {
    if (beepIntervalRef.current != null) {
      window.clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    await wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const armKitchenMode = useCallback(async () => {
    const Ctor = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) {
      setIsArmed(true);
      return;
    }
    const context = audioContextRef.current ?? new Ctor();
    audioContextRef.current = context;
    await context.resume();
    wakeLockRef.current = await requestWakeLock();
    setIsArmed(true);
  }, []);

  useEffect(() => {
    if (!isArmed || !interrupt.visible || !order) {
      stopBeeping();
      if (!interrupt.visible) {
        void releaseWakeLock();
      }
      return;
    }
    if (!audioContextRef.current) return;
    stopBeeping();
    playBeep(audioContextRef.current);
    beepIntervalRef.current = window.setInterval(() => {
      if (audioContextRef.current) {
        playBeep(audioContextRef.current);
      }
    }, 1800);
    return stopBeeping;
  }, [interrupt.visible, isArmed, order, releaseWakeLock, stopBeeping]);

  useEffect(() => {
    return () => {
      stopBeeping();
      void releaseWakeLock();
      void audioContextRef.current?.close().catch(() => undefined);
    };
  }, [releaseWakeLock, stopBeeping]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <KitchenIcon color="primary" />
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {t('kitchenMode.title', 'Kitchen mode')}
              </Typography>
            </Box>
            <Typography color="text.secondary">
              {t(
                'kitchenMode.subtitle',
                'Keep this screen open on a kitchen tablet to hear and handle new orders quickly.'
              )}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                startIcon={<CampaignIcon />}
                onClick={() => void armKitchenMode()}
              >
                {isArmed
                  ? t('kitchenMode.soundReady', 'Sound is enabled')
                  : t('kitchenMode.start', 'Start kitchen mode')}
              </Button>
              <Button variant="outlined" onClick={() => void interrupt.refreshPending()}>
                {t('common.refresh', 'Refresh')}
              </Button>
            </Stack>
            {!isArmed ? (
              <Alert severity="info">
                {t(
                  'kitchenMode.soundHint',
                  'Tap Start kitchen mode once to allow alarm sound in this browser.'
                )}
              </Alert>
            ) : null}
          </Stack>
        </Paper>

        {interrupt.message ? <Alert severity="warning">{interrupt.message}</Alert> : null}

        {!interrupt.visible || !order ? (
          <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {t('kitchenMode.waitingTitle', 'Waiting for the next order')}
            </Typography>
            <Typography color="text.secondary">
              {t(
                'kitchenMode.waitingBody',
                'When a new order needs confirmation, it will appear here immediately.'
              )}
            </Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
            <Stack spacing={3}>
              <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap">
                <Box>
                  <Typography variant="overline" color="error.main">
                    {t('incomingOrder.kitchenAlert', 'New order alert')}
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {t('incomingOrder.orderNumber', 'Order {{number}}', {
                      number: order.order_number,
                    })}
                  </Typography>
                  {customerName ? (
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      {customerName}
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Chip
                    icon={<AccessTimeIcon />}
                    color="error"
                    label={formatCountdown(interrupt.secondsLeft, t)}
                    sx={{
                      height: 56,
                      '& .MuiChip-label': { px: 1.5, fontSize: 24, fontWeight: 700 },
                    }}
                  />
                  <Chip
                    label={formatCurrency(order.total_amount, order.currency)}
                    sx={{
                      height: 56,
                      '& .MuiChip-label': { px: 1.5, fontSize: 24, fontWeight: 700 },
                    }}
                  />
                </Stack>
              </Box>

              {order.special_instructions ? (
                <Alert severity="info">{order.special_instructions}</Alert>
              ) : null}

              <List
                disablePadding
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                {order.order_items.map((item, index) => (
                  <ListItem key={item.id || `${item.item_name}-${index}`} divider={index < order.order_items.length - 1}>
                    <ListItemText
                      primary={item.item_name || item.item?.name || t('orders.orderItem', 'Order item')}
                      secondary={t('orders.quantity', 'Quantity') + `: ${item.quantity ?? 0}`}
                    />
                  </ListItem>
                ))}
              </List>

              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<CheckCircleOutlineIcon />}
                  onClick={() => void interrupt.confirm()}
                  disabled={isWorking}
                >
                  {interrupt.uiState === 'confirming'
                    ? t('orders.confirmModal.confirming', 'Confirming...')
                    : t('incomingOrder.confirm', 'Confirm order')}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => void interrupt.markBusy()}
                  disabled={isWorking}
                >
                  {interrupt.uiState === 'busy'
                    ? t('incomingOrder.markingBusy', 'Updating...')
                    : t('incomingOrder.busyAction', 'Need more time')}
                </Button>
                <Button
                  variant="text"
                  size="large"
                  color="error"
                  onClick={interrupt.openDeclineDialog}
                  disabled={isWorking}
                >
                  {t('incomingOrder.decline', 'Cancel order')}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
      </Stack>

      {order ? (
        <CancellationReasonModal
          open={interrupt.showDeclineDialog}
          onClose={interrupt.closeDeclineDialog}
          order={order}
          persona="business"
          onSuccess={interrupt.onDeclineSuccess}
        />
      ) : null}
    </Container>
  );
}

export default KitchenModePage;
