import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionAuth } from '../contexts/SessionAuthContext';
import { setPendingLikeItemId } from '../utils/pendingLikeItemId';
import { useApiClient } from './useApiClient';

export function useItemLike(
  itemId: string | null | undefined,
  initiallyLiked = false
) {
  const apiClient = useApiClient();
  const { isAuthenticated } = useSessionAuth();
  const [liked, setLiked] = useState(initiallyLiked);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [pendingOptimistic, setPendingOptimistic] = useState(false);
  const syncedItemRef = useRef(itemId);
  const localOverrideRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (syncedItemRef.current !== itemId) {
      syncedItemRef.current = itemId;
      localOverrideRef.current = null;
      setLiked(initiallyLiked);
      setPendingOptimistic(false);
      setSaveSheetOpen(false);
      return;
    }
    if (localOverrideRef.current === null) {
      setLiked(initiallyLiked);
    }
  }, [itemId, initiallyLiked]);

  const persistLike = useCallback(
    async (nextLiked: boolean) => {
      if (!itemId) return;
      await apiClient.put(`/item-likes/${itemId}`, { liked: nextLiked });
    },
    [apiClient, itemId]
  );

  const closeSaveSheet = useCallback(() => {
    setSaveSheetOpen(false);
    setLiked(false);
    setPendingOptimistic(false);
    localOverrideRef.current = null;
  }, []);

  const beginAuthForLike = useCallback(() => {
    if (!itemId) return;
    setPendingLikeItemId(itemId);
    setSaveSheetOpen(false);
  }, [itemId]);

  const toggleLike = useCallback(async () => {
    if (!itemId) return liked;
    if (!isAuthenticated) {
      setLiked(true);
      setPendingOptimistic(true);
      setSaveSheetOpen(true);
      return true;
    }
    const previous = liked;
    const next = !liked;
    localOverrideRef.current = next;
    setLiked(next);
    try {
      await persistLike(next);
      return next;
    } catch {
      localOverrideRef.current = previous;
      setLiked(previous);
      return previous;
    }
  }, [itemId, isAuthenticated, liked, persistLike]);

  return {
    liked,
    saveSheetOpen,
    pendingOptimistic,
    toggleLike,
    closeSaveSheet,
    beginAuthForLike,
  };
}
