import React from 'react';
import { Typography } from '@mui/material';
import type { OrderMessage } from '../../hooks/useOrderMessages';
import { DeliveryPinMessageCard } from './DeliveryPinMessageCard';

interface MessageRendererProps {
  message: OrderMessage;
  compact?: boolean;
}

function parseDisplayMessage(message: string): string {
  try {
    const parsed = JSON.parse(message) as { i18nKey?: string; params?: Record<string, string> };
    if (parsed.i18nKey === 'orders.messaging.deliveryPin.shared' && parsed.params?.agentName) {
      return `Delivery PIN sent to ${parsed.params.agentName}`;
    }
  } catch {
    // plain text
  }
  return message;
}

export function MessageRenderer({ message, compact }: MessageRendererProps) {
  if (message.message_type === 'DELIVERY_PIN' && message.structured_content) {
    return (
      <DeliveryPinMessageCard
        content={message.structured_content}
        compact={compact}
      />
    );
  }

  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
      {parseDisplayMessage(message.message)}
    </Typography>
  );
}
