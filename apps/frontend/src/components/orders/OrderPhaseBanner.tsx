import React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
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
  };
  role: OrderPhaseRole;
  action?: React.ReactNode;
}

export const OrderPhaseBanner: React.FC<Props> = ({ order, role, action }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const info = resolveOrderPhase(orderToPhaseInput(order), role);

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
      {action}
    </Stack>
  );
};

export default OrderPhaseBanner;
