import { useCallback, useEffect, useState } from 'react';
import type {
  MentionableParticipant,
  OrderMessage,
} from '../services/agentApi';
import { rentalsApi } from '../services/rentalsApi';

export function useRentalBookingMessages(bookingId: string) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentionableParticipants, setMentionableParticipants] = useState<
    MentionableParticipant[]
  >([]);

  const fetchMessages = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await rentalsApi.getBookingMessages(bookingId);
      if (!res.success) {
        setMessages([]);
        setError(res.error || 'Could not load messages');
        return;
      }
      setMessages(Array.isArray(res.messages) ? res.messages : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load messages';
      setMessages([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const fetchMentionableParticipants = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await rentalsApi.getBookingMentionableParticipants(bookingId);
      if (res.success) {
        setMentionableParticipants(res.participants ?? []);
      }
    } catch {
      // Best-effort
    }
  }, [bookingId]);

  useEffect(() => {
    void fetchMessages();
    void fetchMentionableParticipants();
  }, [fetchMessages, fetchMentionableParticipants]);

  const sendMessage = useCallback(
    async (message: string, mentionedUserId?: string): Promise<boolean> => {
      const trimmed = message.trim();
      if (!trimmed) return false;
      setLoading(true);
      setError(null);
      try {
        const res = await rentalsApi.sendBookingMessage(
          bookingId,
          trimmed,
          mentionedUserId
        );
        if (!res.success) {
          setError(res.error || 'Could not send message');
          return false;
        }
        if (res.message) {
          setMessages((prev) => [res.message as OrderMessage, ...prev]);
        } else {
          await fetchMessages();
        }
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not send message';
        setError(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [bookingId, fetchMessages]
  );

  const markMessagesRead = useCallback(
    async (lastReadMessageId: string): Promise<void> => {
      if (!bookingId || !lastReadMessageId) return;
      try {
        await rentalsApi.markBookingMessagesRead(bookingId, lastReadMessageId);
      } catch {
        // Best-effort
      }
    },
    [bookingId]
  );

  return {
    messages,
    loading,
    error,
    refetch: fetchMessages,
    sendMessage,
    markMessagesRead,
    mentionableParticipants,
  };
}
