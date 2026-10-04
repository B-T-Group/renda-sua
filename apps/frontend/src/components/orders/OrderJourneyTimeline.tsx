import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { orderToPhaseInput, resolveOrderPhase, type OrderPhaseSource } from '../../utils/orderPhase';

const STEPS = ['placed', 'confirmed', 'preparing', 'on_the_way', 'delivered'] as const;

/** Narrative progress for a client order. Hides raw status enums. */
export function OrderJourneyTimeline({ order }: { order: OrderPhaseSource }) {
  const { t } = useTranslation();
  const phase = resolveOrderPhase(orderToPhaseInput(order), 'client').phase;
  const active = phase === 'done' ? 4 : phase === 'in_delivery' ? 3 : phase === 'ready' || phase === 'prepare' ? 2 : phase === 'confirm' ? 1 : 0;
  const message =
    phase === 'in_delivery'
      ? t('client.journey.onTheWay', 'Your order is on the way.')
      : phase === 'done'
        ? t('client.journey.messageDelivered', 'Your order was delivered.')
        : phase === 'prepare' || phase === 'ready'
          ? t('client.journey.messagePreparing', 'Your order is being prepared.')
          : phase === 'pay'
            ? t('client.journey.pay', 'Payment is the next step.')
            : t('client.journey.messagePlaced', 'Your order is with the store.');
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h3">{message}</Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
        {STEPS.map((step, index) => (
          <Box key={step} sx={{ flex: 1, textAlign: 'center' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', mx: 'auto', bgcolor: index <= active ? 'primary.main' : 'divider' }} />
            <Typography variant="caption">{t(`client.journey.${step}`, stepLabel(step))}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function stepLabel(step: (typeof STEPS)[number]): string {
  if (step === 'placed') return 'Placed';
  if (step === 'confirmed') return 'Confirmed';
  if (step === 'preparing') return 'Preparing';
  if (step === 'on_the_way') return 'On the way';
  return 'Delivered';
}
