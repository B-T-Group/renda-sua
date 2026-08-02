import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator,
} from '@mui/lab';
import { Box, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useOrderPickupOps,
  type OrderEventRow,
} from '../../hooks/useOrderPickupOps';

interface OrderEventsTimelineProps {
  orderId: string;
}

const EVENT_LABELS: Record<string, { en: string; fr: string }> = {
  agent_assigned: { en: 'Agent assigned', fr: 'Livreur assigné' },
  pickup_reminder_sent: { en: 'Pickup reminder sent', fr: 'Rappel de collecte' },
  pickup_at_risk: { en: 'Pickup at risk', fr: 'Collecte à risque' },
  pickup_overdue: { en: 'Pickup overdue', fr: 'Collecte en retard' },
  agent_extension_requested: {
    en: 'Agent requested more time',
    fr: 'Livreur a demandé plus de temps',
  },
  agent_arrived_pickup: {
    en: 'Agent arrived at pickup',
    fr: 'Livreur arrivé au point de collecte',
  },
  agent_reported_issue: {
    en: 'Agent reported an issue',
    fr: 'Livreur a signalé un problème',
  },
  merchant_delay_started: {
    en: 'Merchant delay started',
    fr: 'Retard commerçant commencé',
  },
  merchant_delay_ended: {
    en: 'Merchant delay ended',
    fr: 'Retard commerçant terminé',
  },
  support_hold_started: {
    en: 'Support hold started',
    fr: 'Mise en pause support',
  },
  support_hold_ended: {
    en: 'Support hold ended',
    fr: 'Fin de pause support',
  },
  reassignment_started: {
    en: 'Reassignment started',
    fr: 'Réaffectation démarrée',
  },
  reassigned: { en: 'Reassigned', fr: 'Réaffectée' },
  customer_notified_delay: {
    en: 'Customer notified of delay',
    fr: 'Client informé du retard',
  },
};

export const OrderEventsTimeline: React.FC<OrderEventsTimelineProps> = ({
  orderId,
}) => {
  const { t, i18n } = useTranslation();
  const { fetchOrderEvents } = useOrderPickupOps();
  const [events, setEvents] = useState<OrderEventRow[]>([]);

  useEffect(() => {
    void fetchOrderEvents(orderId).then(setEvents);
  }, [fetchOrderEvents, orderId]);

  if (events.length === 0) return null;
  const locale = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {t('orders.pickupSla.timeline', 'Operational timeline')}
      </Typography>
      <Timeline position="right">
        {events.map((event, index) => {
          const label =
            EVENT_LABELS[event.event_type]?.[locale] || event.event_type;
          return (
            <TimelineItem key={event.id}>
              <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.3 }}>
                {new Date(event.created_at).toLocaleString()}
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot color="primary" />
                {index < events.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {event.actor_type}
                </Typography>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
    </Box>
  );
};
