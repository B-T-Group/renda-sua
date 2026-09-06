import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { messagesApi } from '../services/messagesApi';
import type { UserMessage } from '../types/messages';

interface UseNotificationsResult {
  messages: UserMessage[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  refresh: (silent?: boolean) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [msgRes, countRes] = await Promise.all([
        messagesApi.list({ limit: 100 }),
        messagesApi.getUnreadCount(),
      ]);
      setMessages(msgRes.messages ?? []);
      setUnreadCount(countRes.count ?? 0);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      await load(true);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    await messagesApi.markRead(id);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read_at: new Date().toISOString() } : m))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await messagesApi.markAllRead();
    const now = new Date().toISOString();
    setMessages((prev) => prev.map((m) => ({ ...m, read_at: m.read_at ?? now })));
    setUnreadCount(0);
  }, []);

  return { messages, unreadCount, loading, refreshing, refresh, markRead, markAllRead };
}
