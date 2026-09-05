import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStorePickupReminder } from '../../hooks/useStorePickupReminder';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';

export function StorePickupReminderOverlay() {
  const { t } = useTranslation();
  const reminder = useStorePickupReminder();

  return (
    <>
      <Dialog
        open={reminder.visible}
        onClose={reminder.dismiss}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorefrontOutlinedIcon color="primary" />
          {t('orders.storePickupReminder.title', 'Your order is waiting')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            {reminder.orderNumber ? (
              <Typography variant="subtitle1" color="primary.main">
                {t('orders.orderNumber', 'Order #{{orderNumber}}', {
                  orderNumber: reminder.orderNumber,
                })}
              </Typography>
            ) : null}
            <Typography variant="body1">
              {t(
                'orders.storePickupReminder.body',
                'This store pickup order is still ready. Message the business to let them know you are coming, or cancel if you can no longer collect it.'
              )}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, p: 2 }}>
          <Button
            variant="contained"
            startIcon={<ChatOutlinedIcon />}
            onClick={reminder.messageBusiness}
            disabled={!reminder.orderId}
          >
            {t(
              'orders.storePickupReminder.messageBusiness',
              'Message the business'
            )}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={reminder.openCancel}
            disabled={!reminder.order}
          >
            {t('orders.storePickupReminder.cancelOrder', 'Cancel order')}
          </Button>
          <Button variant="text" onClick={reminder.dismiss}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>

      {reminder.order ? (
        <CancellationReasonModal
          open={reminder.showCancel}
          onClose={reminder.closeCancel}
          order={reminder.order}
          persona="client"
          onSuccess={reminder.onCancelSuccess}
        />
      ) : null}
    </>
  );
}

export default StorePickupReminderOverlay;
