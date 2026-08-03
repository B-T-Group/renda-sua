import React from 'react';
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type {
  OrderMessage,
  QuickMessageStructuredContent,
} from '../../hooks/useOrderMessages';
import { DeliveryPinMessageCard } from './DeliveryPinMessageCard';
import { QuickMessageCard } from './QuickMessageCard';

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
      defaultMessage?: string;
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
    if (parsed.i18nKey === 'orders.noAgentFound.message' && parsed.params?.orderNumber) {
      return t(
        'orders.noAgent.messagePlain',
        "We couldn't find a nearby courier for order #{{orderNumber}}. Check your order for options.",
        { orderNumber: parsed.params.orderNumber }
      );
    }
    if (parsed.i18nKey?.startsWith('orders.quickMessages.')) {
      return t(
        parsed.i18nKey,
        parsed.defaultMessage ?? 'Quick message',
        parsed.params
      );
    }
  } catch {
    // plain text
  }
  return message;
}

function isQuickMessageContent(
  content: OrderMessage['structured_content']
): content is QuickMessageStructuredContent {
  return !!content && 'templateId' in content && 'bodyI18nKey' in content;
}

export function MessageRenderer({ message, compact }: MessageRendererProps) {
  const { t } = useTranslation();

  if (message.message_type === 'DELIVERY_PIN' && message.structured_content) {
    return (
      <DeliveryPinMessageCard
        content={message.structured_content as any}
        compact={compact}
      />
    );
  }

  if (message.message_type === 'RENTAL_START_PIN' && message.structured_content) {
    return (
      <DeliveryPinMessageCard
        content={message.structured_content as any}
        compact={compact}
        variant="rentalStart"
      />
    );
  }

  if (
    message.message_type === 'QUICK_MESSAGE' &&
    isQuickMessageContent(message.structured_content)
  ) {
    return (
      <QuickMessageCard content={message.structured_content} compact={compact} />
    );
  }

  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
      {parseDisplayMessage(message.message, t)}
    </Typography>
  );
}
