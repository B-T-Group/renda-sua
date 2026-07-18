import React from 'react';
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { OrderMessage } from '../../hooks/useOrderMessages';
import { DeliveryPinMessageCard } from './DeliveryPinMessageCard';

interface MessageRendererProps {
  message: OrderMessage;
  compact?: boolean;
}

function parseDisplayMessage(
  message: string,
  t: (key: string, defaultValue: string, options?: Record<string, string>) => string
): string {
  try {
    const parsed = JSON.parse(message) as {
      i18nKey?: string;
      params?: Record<string, string>;
    };
    if (parsed.i18nKey === 'orders.messaging.deliveryPin.shared' && parsed.params?.agentName) {
      return t(
        'orders.messaging.deliveryPin.sharedPlain',
        'Delivery PIN sent to {{agentName}}',
        { agentName: parsed.params.agentName }
      );
    }
    if (
      parsed.i18nKey === 'rentals.messaging.startPin.shared' &&
      parsed.params?.businessName
    ) {
      return t(
        'rentals.messaging.startPin.sharedPlain',
        'Start PIN sent to {{businessName}}',
        { businessName: parsed.params.businessName }
      );
    }
  } catch {
    // plain text
  }
  return message;
}

export function MessageRenderer({ message, compact }: MessageRendererProps) {
  const { t } = useTranslation();

  if (message.message_type === 'DELIVERY_PIN' && message.structured_content) {
    return (
      <DeliveryPinMessageCard
        content={message.structured_content}
        compact={compact}
      />
    );
  }

  if (message.message_type === 'RENTAL_START_PIN' && message.structured_content) {
    return (
      <DeliveryPinMessageCard
        content={message.structured_content}
        compact={compact}
        variant="rentalStart"
      />
    );
  }

  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
      {parseDisplayMessage(message.message, t)}
    </Typography>
  );
}
