import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useActionsNeeded } from '@/hooks/useActionsNeeded';
import { useNotifications } from '@/hooks/useNotifications';

type Persona = 'business' | 'agent' | 'client';

export interface PersonaAttentionBadge {
  /** Actions-needed count for tab badges (Activity unread is on the bell only). */
  totalCount: number;
  /** OS app-icon badge: actions + unread Activity (push may set unread independently). */
  appIconBadgeCount: number;
  actionsCount: number;
  unreadNotifications: number;
  refresh: () => Promise<void>;
}

/**
 * Unified persona attention badge for home/browse tabs.
 * Tab badge reflects Actions Needed only; unread Activity count is shown on the bell.
 */
export function usePersonaAttentionBadge(persona: Persona | null): PersonaAttentionBadge {
  const { totalCount: actionsCount, refresh: refreshActions } = useActionsNeeded(persona);
  const { unreadCount, refresh: refreshNotifications } = useNotifications();

  const refresh = useCallback(async () => {
    await Promise.all([refreshActions(), refreshNotifications(true)]);
  }, [refreshActions, refreshNotifications]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const id = setInterval(() => {
        void refreshNotifications(true);
      }, 30_000);
      return () => clearInterval(id);
    }, [refresh, refreshNotifications])
  );

  const totalCount = actionsCount;

  return {
    totalCount,
    appIconBadgeCount: actionsCount + unreadCount,
    actionsCount,
    unreadNotifications: unreadCount,
    refresh,
  };
}
