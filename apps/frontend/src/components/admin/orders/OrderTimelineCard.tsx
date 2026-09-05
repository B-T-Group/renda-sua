import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminOrderDetail } from '../../../hooks/useAdminOrders';

interface OrderTimelineCardProps {
  timeline: AdminOrderDetail['timeline'];
  messages: AdminOrderDetail['messages'];
}

export const OrderTimelineCard: React.FC<OrderTimelineCardProps> = ({
  timeline,
  messages,
}) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t('admin.orders.timeline', 'Operational timeline')}
        </Typography>
        {timeline.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('admin.orders.noTimeline', 'Nothing has happened on this order yet.')}
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ maxHeight: 320, overflowY: 'auto' }}>
            {timeline.map((event) => (
              <Box key={event.id}>
                <Typography variant="body2" fontWeight={600}>
                  {event.event_type.replace(/_/g, ' ')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {event.actor_type} · {new Date(event.created_at).toLocaleString()}
                </Typography>
                {renderPayload(event.payload)}
              </Box>
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t('admin.orders.messageHistory', 'Messages')}
        </Typography>
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('admin.orders.noMessages', 'No messages have been sent yet.')}
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {messages.map((message) => (
              <Box key={message.id}>
                <Typography variant="body2">{message.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {message.sender_name || t('admin.orders.support', 'Support')}
                  {message.recipient_types.length
                    ? ` → ${message.recipient_types.join(', ')}`
                    : ''}
                  {' · '}
                  {new Date(message.created_at).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

function renderPayload(payload: Record<string, unknown>): React.ReactNode {
  const entries = Object.entries(payload ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );
  if (!entries.length) return null;
  return (
    <Typography variant="caption" color="text.secondary" display="block">
      {entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
    </Typography>
  );
}
