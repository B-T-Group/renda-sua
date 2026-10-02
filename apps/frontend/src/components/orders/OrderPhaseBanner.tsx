import { AccessTime } from '@mui/icons-material';
import { Chip, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import {
  formatPayByTime,
  payAfterPayByDeadline,
  payByUrgency,
  splitAroundTime,
} from '../../utils/payAfterConfirm';
import {
  resolveOrderPhase,
  orderToPhaseInput,
  type OrderPhaseRole,
} from '../../utils/orderPhase';

const PHASE_DEFAULTS: Record<string, string> = {
  'orders.phases.pay': 'Payment needed',
  'orders.phases.confirm': 'Awaiting confirmation',
  'orders.phases.prepare': 'Preparing',
  'orders.phases.ready': 'Ready',
  'orders.phases.inDelivery': 'In delivery',
  'orders.phases.done': 'Done',
};

interface Props {
  order: {
    current_status?: string | null;
    fulfillment_method?: string | null;
    payment_timing?: string | null;
    payment_status?: string | null;
    payment_method?: string | null;
    assigned_agent_id?: string | null;
    reconciliation_status?: string | null;
    is_cooked_food_pickup?: boolean | null;
    pay_after_merchant_confirm?: boolean | null;
    order_items?: Array<{
      is_cooked_food?: boolean | null;
      item?: { is_cooked_food?: boolean | null } | null;
    }> | null;
    order_status_history?: Array<{ status?: string | null; created_at: string }> | null;
  };
  role: OrderPhaseRole;
  action?: React.ReactNode;
}

export const OrderPhaseBanner: React.FC<Props> = ({ order, role, action }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const info = resolveOrderPhase(orderToPhaseInput(order), role);
  const payByDeadline = role === 'client' ? payAfterPayByDeadline(order) : null;
  const [now, setNow] = useState(() => new Date());
  const hasPayBy = payByDeadline != null;

  // Re-evaluate the warning / expired state while the pay-by line is visible.
  useEffect(() => {
    if (!hasPayBy) return undefined;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [hasPayBy]);

  // Complete orders already show status elsewhere; the next-step alert adds noise.
  if (order.current_status === 'complete') {
    return null;
  }

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.info.main, 0.35),
        bgcolor: alpha(theme.palette.info.main, 0.08),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Chip
          size="small"
          label={t(info.labelKey, PHASE_DEFAULTS[info.labelKey] ?? info.phase)}
          color="info"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
        <Typography variant="caption" color="info.main" fontWeight={700}>
          {t('orders.nextStep.label', 'Next step')}
        </Typography>
      </Stack>
      {info.nextStepKey ? (
        <Typography variant="body2" color="text.primary">
          {t(info.nextStepKey, '')}
        </Typography>
      ) : null}
      {payByDeadline ? (
        <PayByLine
          deadline={payByDeadline}
          now={now}
          language={i18n.language}
        />
      ) : null}
      {action}
    </Stack>
  );
};

const PayByLine: React.FC<{
  deadline: Date;
  now: Date;
  language: string;
}> = ({ deadline, now, language }) => {
  const { t } = useTranslation();
  const urgency = payByUrgency(deadline, now);

  if (urgency === 'expired') {
    return (
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <AccessTime fontSize="small" color="error" sx={{ mt: '2px' }} />
        <Typography variant="body2" color="error.main" fontWeight={600}>
          {t(
            'orders.payAfterConfirm.payByExpired',
            'The payment window has ended. This order will be cancelled automatically and you will not be charged.'
          )}
        </Typography>
      </Stack>
    );
  }

  const time = formatPayByTime(
    deadline,
    language,
    now,
    t('orders.payAfterConfirm.tomorrow', 'tomorrow')
  );
  const text = t(
    'orders.payAfterConfirm.payBy',
    "Pay by {{time}}. You haven't been charged yet. If you miss it, the order is cancelled and nothing is charged.",
    { time, interpolation: { escapeValue: false } }
  );
  const parts = splitAroundTime(text, time);
  const color = urgency === 'urgent' ? 'warning.dark' : 'text.primary';
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      data-testid="pay-by-line"
    >
      <AccessTime
        fontSize="small"
        sx={{ color, mt: '2px' }}
        aria-hidden
      />
      <Typography variant="body2" sx={{ color }}>
        {parts ? (
          <>
            {parts.before}
            <Typography component="span" variant="body2" fontWeight={800} color="inherit">
              {parts.time}
            </Typography>
            {parts.after}
          </>
        ) : (
          text
        )}
      </Typography>
    </Stack>
  );
};

export default OrderPhaseBanner;
