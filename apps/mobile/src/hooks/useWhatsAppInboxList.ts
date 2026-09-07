import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { PlatformPermissions } from '../constants/platformPermissions';
import { usePermissions } from './usePermissions';
import { useProfileMe } from './useProfileMe';
import {
  fetchWhatsAppInbox,
  patchWhatsAppInboxConversation,
} from '../services/whatsappInboxApi';
import type {
  WhatsAppInboxConversation,
  WhatsAppInboxStatus,
} from '../types/whatsappInbox';

export function useWhatsAppInboxList() {
  const { me, loading: profileLoading } = useProfileMe();
  const { can, isSuperuser } = usePermissions(me);
  const canAccess =
    isSuperuser || can(PlatformPermissions.OPS_WHATSAPP_INBOX);

  const [status, setStatus] = useState<WhatsAppInboxStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<WhatsAppInboxConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (!canAccess) return;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchWhatsAppInbox({
          status,
          search: search.trim() || undefined,
        });
        setItems(res.items);
        setTotal(res.total);
        setConfigured(res.configured);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccess, search, status]
  );

  useFocusEffect(
    useCallback(() => {
      void load('load');
    }, [load])
  );

  const markRead = useCallback(async (id: string) => {
    try {
      await patchWhatsAppInboxConversation(id, { markRead: true });
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );
    } catch {
      // Non-blocking: thread screen still opens.
    }
  }, []);

  return useMemo(
    () => ({
      canAccess,
      profileLoading,
      status,
      setStatus,
      search,
      setSearch,
      items,
      total,
      configured,
      loading,
      refreshing,
      error,
      refresh: () => load('refresh'),
      markRead,
    }),
    [
      canAccess,
      profileLoading,
      status,
      search,
      items,
      total,
      configured,
      loading,
      refreshing,
      error,
      load,
      markRead,
    ]
  );
}
