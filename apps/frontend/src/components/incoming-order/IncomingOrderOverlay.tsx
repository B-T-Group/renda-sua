import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { OrderData } from '../../hooks/useOrderById';
import { useIncomingOrderInterrupt } from '../../hooks/useIncomingOrderInterrupt';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';

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

function clientName(order: OrderData | null): string {
  return [order?.client?.user?.first_name, order?.client?.user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function ItemsList({ order }: { order: OrderData }) {
  const { t } = useTranslation();
  return (
    <List disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      {order.order_items.map((item, index) => (
        <ListItem
          key={item.id || `${item.item_name}-${index}`}
          divider={index < order.order_items.length - 1}
        >
          <ListItemText
            primary={item.item_name || item.item?.name || t('orders.orderItem', 'Order item')}
            secondary={t('orders.quantity', 'Quantity') + `: ${item.quantity ?? 0}`}
          />
        </ListItem>
      ))}
    </List>
  );
}

export function IncomingOrderOverlay() {
  const { t } = useTranslation();
  const location = useLocation();
  const interrupt = useIncomingOrderInterrupt();
  const isKitchenRoute = location.pathname === '/kitchen';
  const isBusy = interrupt.uiState === 'busy';
  const isConfirming = interrupt.uiState === 'confirming';
  const isWorking = isBusy || isConfirming;
  const order = interrupt.order;

  if (isKitchenRoute) return null;

  return (
    <>
      <Dialog
        open={interrupt.visible}
        fullScreen
        disableEscapeKeyDown
        onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        }}
      >
        <DialogContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={3} sx={{ maxWidth: 900, mx: 'auto', minHeight: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
              <Box>
                <Typography variant="overline" color="error.main">
                  {t('incomingOrder.kitchenAlert', 'New order alert')}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {t('incomingOrder.title', 'New order')}
                </Typography>
                {order?.order_number ? (
                  <Typography variant="h6" color="primary.main">
                    {t('incomingOrder.orderNumber', 'Order {{number}}', {
                      number: order.order_number,
                    })}
                  </Typography>
                ) : null}
                {clientName(order) ? (
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    {clientName(order)}
                  </Typography>
                ) : null}
              </Box>
              <IconButton
                onClick={interrupt.dismiss}
                disabled={isWorking}
                aria-label={t('incomingOrder.dismiss', 'Review later')}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {interrupt.message ? <Alert severity="warning">{interrupt.message}</Alert> : null}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Chip
                icon={<TimerOutlinedIcon />}
                color="error"
                label={formatCountdown(interrupt.secondsLeft, t)}
                sx={{ height: 44, '& .MuiChip-label': { px: 1, fontSize: 16, fontWeight: 700 } }}
              />
              {order ? (
                <Chip
                  icon={<AccessTimeIcon />}
                  label={formatCurrency(order.total_amount, order.currency)}
                  sx={{ height: 44, '& .MuiChip-label': { px: 1, fontSize: 16, fontWeight: 700 } }}
                />
              ) : null}
            </Stack>

            {order?.special_instructions ? (
              <Alert severity="info">{order.special_instructions}</Alert>
            ) : null}

            {order ? <ItemsList order={order} /> : null}

            <Box sx={{ mt: 'auto' }}>
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void interrupt.confirm()}
                  disabled={!order || isWorking}
                  startIcon={<CheckCircleOutlineIcon />}
                >
                  {isConfirming
                    ? t('orders.confirmModal.confirming', 'Confirming...')
                    : t('incomingOrder.confirm', 'Confirm order')}
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'incomingOrder.confirmHint',
                    'Confirm if you can prepare this order.'
                  )}
                </Typography>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => void interrupt.markBusy()}
                  disabled={!order || isWorking}
                >
                  {isBusy
                    ? t('incomingOrder.markingBusy', 'Updating...')
                    : t('incomingOrder.busyAction', 'Need more time')}
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {t('incomingOrder.busyHint', 'We’ll remind you again in about 15 minutes.')}
                </Typography>
                <Button
                  variant="text"
                  size="large"
                  onClick={interrupt.dismiss}
                  disabled={isWorking}
                >
                  {t('incomingOrder.dismiss', 'Review later')}
                </Button>
                <Button
                  variant="text"
                  color="error"
                  size="large"
                  onClick={interrupt.openDeclineDialog}
                  disabled={!order || isWorking}
                >
                  {t('incomingOrder.decline', 'Cancel order')}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      {order ? (
        <CancellationReasonModal
          open={interrupt.showDeclineDialog}
          onClose={interrupt.closeDeclineDialog}
          order={order}
          persona="business"
          onSuccess={interrupt.onDeclineSuccess}
        />
      ) : null}
    </>
  );
}

export default IncomingOrderOverlay;
