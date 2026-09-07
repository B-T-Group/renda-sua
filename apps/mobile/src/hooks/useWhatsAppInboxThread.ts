import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { PlatformPermissions } from '../constants/platformPermissions';
import { usePermissions } from './usePermissions';
import { useProfileMe } from './useProfileMe';
import {
  fetchWhatsAppInboxThread,
  patchWhatsAppInboxConversation,
  sendWhatsAppInboxReply,
} from '../services/whatsappInboxApi';
import type {
  WhatsAppInboxConversation,
  WhatsAppInboxMessage,
} from '../types/whatsappInbox';

export function useWhatsAppInboxThread(conversationId: string) {
  const { me, loading: profileLoading } = useProfileMe();
  const { can, isSuperuser } = usePermissions(me);
  const canAccess =
    isSuperuser || can(PlatformPermissions.OPS_WHATSAPP_INBOX);

  const [conversation, setConversation] =
    useState<WhatsAppInboxConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppInboxMessage[]>([]);
  const [canReply, setCanReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (!canAccess || !conversationId) return;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchWhatsAppInboxThread(conversationId);
        setConversation(res.conversation);
        setMessages(res.items ?? []);
        setCanReply(res.canReply);
        if ((res.conversation.unreadCount ?? 0) > 0) {
          await patchWhatsAppInboxConversation(conversationId, {
            markRead: true,
          });
          setConversation({ ...res.conversation, unreadCount: 0 });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccess, conversationId]
  );

  useFocusEffect(
    useCallback(() => {
      void load('load');
    }, [load])
  );

  const sendReply = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !canReply) return false;
      setSending(true);
      setSendError(null);
      try {
        await sendWhatsAppInboxReply(conversationId, trimmed);
        await load('refresh');
        return true;
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
        setSendError(message);
        return false;
      } finally {
        setSending(false);
      }
    },
    [canReply, conversationId, load]
  );

  const closeConversation = useCallback(async () => {
    const res = await patchWhatsAppInboxConversation(conversationId, {
      status: 'closed',
    });
    setConversation(res.conversation);
  }, [conversationId]);

  return useMemo(
    () => ({
      canAccess,
      profileLoading,
      conversation,
      messages,
      canReply,
      loading,
      refreshing,
      sending,
      error,
      sendError,
      refresh: () => load('refresh'),
      sendReply,
      closeConversation,
    }),
    [
      canAccess,
      profileLoading,
      conversation,
      messages,
      canReply,
      loading,
      refreshing,
      sending,
      error,
      sendError,
      load,
      sendReply,
      closeConversation,
    ]
  );
}
