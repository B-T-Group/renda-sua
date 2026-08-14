import { useCallback, useState } from 'react';
import {
  useOrdersApiPrefix,
  withOrdersApiPrefix,
} from '../contexts/OrdersApiPrefixContext';
import { useApiClient } from './useApiClient';

export type PersonaId = 'client' | 'agent' | 'business';

export interface MessageMention {
  mentionedUserId: string;
  persona: PersonaId;
  displayName: string;
  textOffset?: number | null;
  textLength?: number | null;
}

export interface DeliveryPinStructuredContent {
  status: 'active' | 'superseded' | 'revoked';
  pinVersion: number;
  sharedToUserId: string;
  sharedToDisplayName?: string;
  pin?: string;
  maskedDisplay: string;
  supersededByMessageId?: string;
  revokedAt?: string;
  revokedReason?: string;
}

export interface QuickMessageStructuredContent {
  templateId: string;
  taggedUserIds: string[];
  taggedPersonas: string[];
  bodyI18nKey: string;
  bodyDefault: string;
}

export interface OrderMessage {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  sender_persona?: PersonaId;
  message_type?: string;
  structured_content?:
    | DeliveryPinStructuredContent
    | QuickMessageStructuredContent
    | null;
  mention?: MessageMention | null;
  mentions?: MessageMention[];
  user: {
    id: string;
    identifier?: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  entity_type_info?: {
    id: string;
    comment: string;
  };
}

export interface MentionableParticipant {
  userId: string;
  persona: PersonaId;
  displayName: string;
}

export interface OrderMessagesResponse {
  success: boolean;
  messages: OrderMessage[];
  error?: string;
}

export interface CreateOrderMessageResponse {
  success: boolean;
  message: OrderMessage;
  error?: string;
}

export interface MentionableParticipantsResponse {
  success: boolean;
  participants: MentionableParticipant[];
  error?: string;
}

export interface UseOrderMessagesReturn {
  messages: OrderMessage[];
  loading: boolean;
  error: string | null;
  fetchMessages: (orderId: string) => Promise<void>;
  sendMessage: (orderId: string, message: string, mentionedUserId?: string) => Promise<boolean>;
  refetch: (orderId: string) => Promise<void>;
  markMessagesRead: (orderId: string, lastReadMessageId: string) => Promise<void>;
}

export const useOrderMessages = (): UseOrderMessagesReturn => {
  const apiClient = useApiClient();
  const ordersPrefix = useOrdersApiPrefix();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(
    async (orderId: string) => {
      if (!apiClient || !orderId) {
        setError('API client not available or order ID missing');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<OrderMessagesResponse>(
          withOrdersApiPrefix(ordersPrefix, `/orders/${orderId}/messages`)
        );

        if (response.data.success) {
          setMessages(response.data.messages || []);
        } else {
          setError(response.data.error || 'Failed to fetch messages');
          setMessages([]);
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to fetch order messages'
        );
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient, ordersPrefix]
  );

  const sendMessage = useCallback(
    async (
      orderId: string,
      message: string,
      mentionedUserId?: string
    ): Promise<boolean> => {
      if (!apiClient || !orderId || !message.trim()) {
        setError('API client not available, order ID missing, or message is empty');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const payload: { message: string; mentionedUserId?: string } = {
          message: message.trim(),
        };
        if (mentionedUserId) {
          payload.mentionedUserId = mentionedUserId;
        }

        const response = await apiClient.post<CreateOrderMessageResponse>(
          withOrdersApiPrefix(ordersPrefix, `/orders/${orderId}/messages`),
          payload
        );

        if (response.data.success && response.data.message) {
          setMessages((prev) => [response.data.message, ...prev]);
          return true;
        } else {
          setError(response.data.error || 'Failed to send message');
          return false;
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to send message'
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, ordersPrefix]
  );

  const refetch = useCallback(
    async (orderId: string) => {
      await fetchMessages(orderId);
    },
    [fetchMessages]
  );

  const markMessagesRead = useCallback(
    async (orderId: string, lastReadMessageId: string): Promise<void> => {
      if (!apiClient || !orderId || !lastReadMessageId) return;
      try {
        await apiClient.post(withOrdersApiPrefix(ordersPrefix, `/orders/${orderId}/messages/read`), {
          lastReadMessageId,
        });
      } catch {
        // Best-effort — do not surface read-receipt failures
      }
    },
    [apiClient, ordersPrefix]
  );

  return {
    messages,
    loading,
    error,
    fetchMessages,
    sendMessage,
    refetch,
    markMessagesRead,
  };
};
