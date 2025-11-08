import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface OrderMessage {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    identifier: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  entity_type_info?: {
    id: string;
    comment: string;
  };
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

export interface UseOrderMessagesReturn {
  messages: OrderMessage[];
  loading: boolean;
  error: string | null;
  fetchMessages: (orderId: string) => Promise<void>;
  sendMessage: (orderId: string, message: string) => Promise<boolean>;
  refetch: (orderId: string) => Promise<void>;
}

export const useOrderMessages = (): UseOrderMessagesReturn => {
  const apiClient = useApiClient();
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
          `/orders/${orderId}/messages`
        );

        if (response.data.success) {
          setMessages(response.data.messages || []);
        } else {
          setError(response.data.error || 'Failed to fetch messages');
          setMessages([]);
        }
      } catch (err: any) {
        console.error('Error fetching order messages:', err);
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
    [apiClient]
  );

  const sendMessage = useCallback(
    async (orderId: string, message: string): Promise<boolean> => {
      if (!apiClient || !orderId || !message.trim()) {
        setError('API client not available, order ID missing, or message is empty');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post<CreateOrderMessageResponse>(
          `/orders/${orderId}/messages`,
          { message: message.trim() }
        );

        if (response.data.success && response.data.message) {
          // Add the new message to the list
          setMessages((prev) => [response.data.message, ...prev]);
          return true;
        } else {
          setError(response.data.error || 'Failed to send message');
          return false;
        }
      } catch (err: any) {
        console.error('Error sending order message:', err);
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
    [apiClient]
  );

  const refetch = useCallback(
    async (orderId: string) => {
      await fetchMessages(orderId);
    },
    [fetchMessages]
  );

  return {
    messages,
    loading,
    error,
    fetchMessages,
    sendMessage,
    refetch,
  };
};

