import React from 'react';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type {
  OrderMessage,
  QuickMessageStructuredContent,
} from '../../services/agentApi';
import { DeliveryPinMessageCard } from './DeliveryPinMessageCard';
import { QuickMessageCard } from './QuickMessageCard';
import { resolveMessageText } from '../../utils/resolveMessageText';

type Props = {
  message: OrderMessage;
};

function isQuickMessageContent(
  content: OrderMessage['structured_content']
): content is QuickMessageStructuredContent {
  return !!content && 'templateId' in content && 'bodyI18nKey' in content;
}

export function MessageRenderer({ message }: Props) {
  const { t } = useTranslation();

  if (message.message_type === 'DELIVERY_PIN' && message.structured_content) {
    return (
      <DeliveryPinMessageCard
        content={message.structured_content as any}
      />
    );
  }

  if (message.message_type === 'RENTAL_START_PIN' && message.structured_content) {
    return (
      <DeliveryPinMessageCard
        content={message.structured_content as any}
        variant="rentalStart"
      />
    );
  }

  if (
    message.message_type === 'QUICK_MESSAGE' &&
    isQuickMessageContent(message.structured_content)
  ) {
    return <QuickMessageCard content={message.structured_content} />;
  }

  return <Text>{resolveMessageText(message.message, t)}</Text>;
}
