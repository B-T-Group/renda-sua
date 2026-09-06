import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type {
  MentionableParticipant,
  OrderMessage,
} from '../services/agentApi';
import { useOrdersApi } from '../contexts/OrdersApiContext';

export function useOrderMessages(orderId: string) {
  const ordersApi = useOrdersApi();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentionableParticipants, setMentionableParticipants] = useState<
    MentionableParticipant[]
  >([]);
  const activeOrderIdRef = useRef(orderId);

  useEffect(() => {
    activeOrderIdRef.current = orderId;
  }, [orderId]);

  const fetchMessages = useCallback(async () => {
    const requestOrderId = orderId;
    if (!requestOrderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ordersApi.getMessages(requestOrderId);
      if (activeOrderIdRef.current !== requestOrderId) return;
      if (!res.success) {
        setMessages([]);
        setError(res.error || 'Impossible de charger les messages');
        return;
      }
      setMessages(Array.isArray(res.messages) ? res.messages : []);
    } catch (e) {
      if (activeOrderIdRef.current !== requestOrderId) return;
      const msg = e instanceof Error ? e.message : 'Impossible de charger les messages';
      setMessages([]);
      setError(msg);
    } finally {
      if (activeOrderIdRef.current === requestOrderId) {
        setLoading(false);
      }
    }
  }, [orderId, ordersApi]);

  const fetchMentionableParticipants = useCallback(async () => {
    const requestOrderId = orderId;
    if (!requestOrderId) return;
    try {
      const res = await ordersApi.getMentionableParticipants(requestOrderId);
      if (activeOrderIdRef.current !== requestOrderId) return;
      if (res.success) {
        setMentionableParticipants(res.participants ?? []);
      }
    } catch {
      // Best-effort — mention picker is advisory only
    }
  }, [orderId, ordersApi]);

  useEffect(() => {
    setMessages([]);
    setMentionableParticipants([]);
    setError(null);
    setLoading(false);
    if (!orderId) return;
    void fetchMessages();
    void fetchMentionableParticipants();
  }, [orderId, fetchMessages, fetchMentionableParticipants]);

  const sendMessage = useCallback(
    async (message: string, mentionedUserId?: string): Promise<boolean> => {
      const trimmed = message.trim();
      const requestOrderId = orderId;
      if (!trimmed || !requestOrderId) return false;
      setLoading(true);
      setError(null);
      try {
        const res = await ordersApi.sendMessage(
          requestOrderId,
          trimmed,
          mentionedUserId
        );
        if (activeOrderIdRef.current !== requestOrderId) return false;
        if (!res.success) {
          setError("Impossible d'envoyer le message");
          return false;
        }
        if (res.message) {
          setMessages((prev) => [res.message as OrderMessage, ...prev]);
        } else {
          await fetchMessages();
        }
        return true;
      } catch (e) {
        if (activeOrderIdRef.current !== requestOrderId) return false;
        const msg = e instanceof Error ? e.message : "Impossible d'envoyer le message";
        setError(msg);
        return false;
      } finally {
        if (activeOrderIdRef.current === requestOrderId) {
          setLoading(false);
        }
      }
    },
    [fetchMessages, orderId, ordersApi]
  );

  const markMessagesRead = useCallback(
    async (lastReadMessageId: string): Promise<void> => {
      if (!orderId || !lastReadMessageId) return;
      if (ordersApi.mode === 'delegate') return;
      try {
        await agentApi.orders.markMessagesRead(orderId, lastReadMessageId);
      } catch {
        // Best-effort
      }
    },
    [orderId, ordersApi.mode]
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
