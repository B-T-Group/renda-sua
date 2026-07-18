import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';
import type {
  MentionableParticipant,
  OrderMessage,
  PersonaId,
} from './useOrderMessages';

export type RentalBookingMessage = OrderMessage;

export interface UseRentalBookingMessagesReturn {
  messages: RentalBookingMessage[];
  loading: boolean;
  error: string | null;
  fetchMessages: (bookingId: string) => Promise<void>;
  sendMessage: (
    bookingId: string,
    message: string,
    mentionedUserId?: string
  ) => Promise<boolean>;
  refetch: (bookingId: string) => Promise<void>;
  markMessagesRead: (
    bookingId: string,
    lastReadMessageId: string
  ) => Promise<void>;
  fetchMentionableParticipants: (
    bookingId: string
  ) => Promise<MentionableParticipant[]>;
}

export const useRentalBookingMessages = (): UseRentalBookingMessagesReturn => {
  const apiClient = useApiClient();
  const [messages, setMessages] = useState<RentalBookingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(
    async (bookingId: string) => {
      if (!apiClient || !bookingId) {
        setError('API client not available or booking ID missing');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          messages: RentalBookingMessage[];
          error?: string;
        }>(`/rentals/bookings/${bookingId}/messages`);
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
            'Failed to fetch rental messages'
        );
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const sendMessage = useCallback(
    async (
      bookingId: string,
      message: string,
      mentionedUserId?: string
    ): Promise<boolean> => {
      if (!apiClient || !bookingId || !message.trim()) {
        setError('API client not available, booking ID missing, or message empty');
        return false;
      }
      setLoading(true);
      setError(null);
      try {
        const payload: { message: string; mentionedUserId?: string } = {
          message: message.trim(),
        };
        if (mentionedUserId) payload.mentionedUserId = mentionedUserId;
        const response = await apiClient.post<{
          success: boolean;
          message: RentalBookingMessage;
          error?: string;
        }>(`/rentals/bookings/${bookingId}/messages`, payload);
        if (response.data.success && response.data.message) {
          setMessages((prev) => [response.data.message, ...prev]);
          return true;
        }
        setError(response.data.error || 'Failed to send message');
        return false;
      } catch (err: any) {
        setError(
          err.response?.data?.error || err.message || 'Failed to send message'
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const refetch = useCallback(
    async (bookingId: string) => {
      await fetchMessages(bookingId);
    },
    [fetchMessages]
  );

  const markMessagesRead = useCallback(
    async (bookingId: string, lastReadMessageId: string): Promise<void> => {
      if (!apiClient || !bookingId || !lastReadMessageId) return;
      try {
        await apiClient.post(`/rentals/bookings/${bookingId}/messages/read`, {
          lastReadMessageId,
        });
      } catch {
        // Best-effort
      }
    },
    [apiClient]
  );

  const fetchMentionableParticipants = useCallback(
    async (bookingId: string): Promise<MentionableParticipant[]> => {
      if (!apiClient || !bookingId) return [];
      try {
        const response = await apiClient.get<{
          success: boolean;
          participants: MentionableParticipant[];
        }>(`/rentals/bookings/${bookingId}/mentionable-participants`);
        return response.data.success ? response.data.participants ?? [] : [];
      } catch {
        return [];
      }
    },
    [apiClient]
  );

  return {
    messages,
    loading,
    error,
    fetchMessages,
    sendMessage,
    refetch,
    markMessagesRead,
    fetchMentionableParticipants,
  };
};

export type { PersonaId, MentionableParticipant };
