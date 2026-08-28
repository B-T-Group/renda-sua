import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreditsFeedbackOrderRow } from '../../../hooks/useAdminCredits';

export type CreditFeedbackAction =
  | 'called_client'
  | 'emailed_client'
  | 'spoke_in_person'
  | 'test_order'
  | 'internal_order';

export interface RecordFeedbackPayload {
  action: CreditFeedbackAction;
  notes: string;
}

interface RecordFeedbackDialogProps {
  open: boolean;
  mode: 'cancelled' | 'first-order' | null;
  order: CreditsFeedbackOrderRow | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: RecordFeedbackPayload) => void | Promise<void>;
}

const ACTIONS: Array<[CreditFeedbackAction, string, string]> = [
  ['called_client', 'admin.credits.action.calledClient', 'Called client'],
  ['emailed_client', 'admin.credits.action.emailedClient', 'Emailed client'],
  [
    'spoke_in_person',
    'admin.credits.action.spokeInPerson',
    'Spoke to client personally',
  ],
  ['test_order', 'admin.credits.action.testOrder', 'Test order'],
  ['internal_order', 'admin.credits.action.internalOrder', 'Internal order'],
];

function personName(user?: CreditsFeedbackOrderRow['client']): string {
  const u = user?.user;
  const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ');
  return name || '—';
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function fulfillmentLabel(
  method: string | null | undefined,
  t: (key: string, fallback: string) => string
): string {
  if (method === 'pickup') {
    return t('admin.credits.fulfillment.pickup', 'Pickup');
  }
  if (method === 'shipping') {
    return t('admin.credits.fulfillment.shipping', 'Shipping');
  }
  if (method === 'delivery') {
    return t('admin.credits.fulfillment.delivery', 'Delivery');
  }
  return method || t('admin.credits.fulfillment.unknown', 'Fulfillment unknown');
}

export const RecordFeedbackDialog: React.FC<RecordFeedbackDialogProps> = ({
  open,
  mode,
  order,
  submitting,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [action, setAction] = useState<CreditFeedbackAction>('called_client');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setAction('called_client');
    setNotes('');
  }, [open, order?.id]);

  const canSubmit = !!action && notes.trim().length > 0 && !submitting;
  const isSkipCredit =
    action === 'test_order' || action === 'internal_order';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({ action, notes: notes.trim() });
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {mode === 'cancelled'
          ? t('admin.credits.cancelledFeedbackTitle', 'Cancelled-order feedback')
          : t('admin.credits.firstOrderFeedbackTitle', 'First-order feedback')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {order ? <OrderBriefing order={order} mode={mode} /> : null}

          <FormControl>
            <FormLabel>
              {t('admin.credits.actionTaken', 'Action taken')}
            </FormLabel>
            <RadioGroup
              value={action}
              onChange={(e) =>
                setAction(e.target.value as CreditFeedbackAction)
              }
            >
              {ACTIONS.map(([value, key, fallback]) => (
                <FormControlLabel
                  key={value}
                  value={value}
                  control={<Radio />}
                  label={t(key, fallback)}
                />
              ))}
            </RadioGroup>
          </FormControl>

          <Typography variant="body2" color="text.secondary">
            {isSkipCredit
              ? t(
                  'admin.credits.skipCreditHint',
                  'Explain why this is not a real credit-worthy call-back. No credit will be awarded.'
                )
              : t(
                  'admin.credits.feedbackHint',
                  'Call the client and record what they shared.'
                )}
          </Typography>

          <TextField
            label={t('admin.credits.feedbackNotes', 'Feedback notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={3}
            required
            fullWidth
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={!!submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {t('admin.credits.saveFeedback', 'Save feedback')}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

const OrderBriefing: React.FC<{
  order: CreditsFeedbackOrderRow;
  mode: 'cancelled' | 'first-order' | null;
}> = ({ order, mode }) => {
  const { t } = useTranslation();
  const phone = order.client?.user?.phone_number?.trim() || '';
  const email = order.client?.user?.email?.trim() || '';
  const stamp =
    mode === 'cancelled' ? order.cancelled_at : order.completed_at;
  const items = (order.order_items ?? []).slice(0, 10);

  return (
    <Stack
      spacing={1.25}
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle2">
        {t('admin.credits.briefing.title', 'Client & order')}
      </Typography>
      <Typography variant="body2">
        {t('admin.credits.briefing.client', 'Client')}: {personName(order.client)}
      </Typography>
      <Typography variant="body2">
        {t('admin.credits.briefing.country', 'Country')}:{' '}
        {order.client?.user?.country?.toUpperCase() || '—'}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <Typography variant="body2" sx={{ minWidth: 0 }}>
          {t('admin.credits.briefing.phone', 'Phone')}: {phone || '—'}
        </Typography>
        {phone ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PhoneIcon fontSize="small" />}
            href={telHref(phone)}
          >
            {t('admin.credits.quickCall', 'Call')}
          </Button>
        ) : null}
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <Typography variant="body2" sx={{ minWidth: 0 }}>
          {t('admin.credits.briefing.email', 'Email')}: {email || '—'}
        </Typography>
        {email ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<EmailIcon fontSize="small" />}
            href={`mailto:${email}`}
          >
            {t('admin.credits.quickEmail', 'Email')}
          </Button>
        ) : null}
      </Stack>

      <Typography variant="body2">
        {t('admin.credits.briefing.order', 'Order')}: #{order.order_number} ·{' '}
        {order.current_status}
        {order.business?.name ? ` · ${order.business.name}` : ''}
      </Typography>
      <Typography variant="body2">
        {t('admin.credits.briefing.fulfillment', 'Fulfillment')}:{' '}
        {fulfillmentLabel(order.fulfillment_method, t)}
      </Typography>
      {stamp ? (
        <Typography variant="body2">
          {mode === 'cancelled'
            ? t('admin.credits.briefing.cancelledAt', 'Cancelled')
            : t('admin.credits.briefing.completedAt', 'Completed')}
          : {new Date(stamp).toLocaleString()}
        </Typography>
      ) : null}
      {order.cancellation_notes ? (
        <Typography variant="body2">
          {t('admin.credits.briefing.cancelNotes', 'Cancel notes')}:{' '}
          {order.cancellation_notes}
        </Typography>
      ) : null}

      {items.length ? (
        <Stack spacing={1} sx={{ pt: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>
            {t('admin.credits.briefing.items', 'Items')}
          </Typography>
          {items.map((item, index) => {
            const label = [item.item_name, item.variant_name]
              .filter(Boolean)
              .join(' · ');
            return (
              <Stack
                key={`${label}-${index}`}
                direction="row"
                spacing={1.25}
                alignItems="center"
              >
                <Box
                  component="img"
                  src={item.image_url || undefined}
                  alt=""
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    objectFit: 'cover',
                    bgcolor: 'action.selected',
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2">
                  {item.quantity}× {label || '—'}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      ) : null}
    </Stack>
  );
};
