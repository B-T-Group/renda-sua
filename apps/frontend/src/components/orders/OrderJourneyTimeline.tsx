import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  clientJourneyActiveIndex,
  clientJourneyMessage,
  clientJourneyStepFallback,
  clientJourneySteps,
  isClientJourneyPickup,
  orderToPhaseInput,
  resolveOrderPhase,
  type OrderPhaseSource,
} from '../../utils/orderPhase';

/** Narrative progress for a client order. Hides raw status enums. */
export function OrderJourneyTimeline({ order }: { order: OrderPhaseSource }) {
  const { t } = useTranslation();
  const input = orderToPhaseInput(order);
  const pickup = isClientJourneyPickup(input);
  const steps = clientJourneySteps(pickup);
  const phase = resolveOrderPhase(input, 'client').phase;
  const active = clientJourneyActiveIndex(phase, steps.length);
  const copy = clientJourneyMessage(phase, pickup);
  const message =
    phase === 'in_delivery' && !pickup
      ? t('client.journey.onTheWay', 'Your order is on the way.')
      : t(copy.key, copy.fallback);
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h3">{message}</Typography>
      <JourneySubtitle phase={phase} fulfillment={order.fulfillment_method} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
        {steps.map((step, index) => (
          <Box key={step} sx={{ flex: 1, textAlign: 'center' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', mx: 'auto', bgcolor: index <= active ? 'primary.main' : 'divider' }} />
            <Typography variant="caption">
              {t(`client.journey.${step}`, clientJourneyStepFallback(step))}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function JourneySubtitle({
  phase,
  fulfillment,
}: {
  phase: string;
  fulfillment?: string | null;
}) {
  const { t } = useTranslation();
  if (phase === 'in_delivery' && fulfillment !== 'pickup') {
    return (
      <Typography variant="body1" sx={{ mt: 0.5 }}>
        {t('client.tracking.outForDelivery', 'Out for delivery')}
      </Typography>
    );
  }
  if (phase === 'ready' && fulfillment === 'pickup') {
    return (
      <Typography variant="body1" sx={{ mt: 0.5 }}>
        {t('client.tracking.readyForPickup', 'Ready for pickup')}
      </Typography>
    );
  }
  return null;
}
