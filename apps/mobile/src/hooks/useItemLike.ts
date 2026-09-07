import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../stores/RootStore';
import { setItemLike } from '../services/itemLikesApi';

export function useItemLike(
  itemId: string | null | undefined,
  initiallyLiked = false
) {
  const { auth } = useStore();
  const pendingLike =
    !!itemId && auth.postAuthResumeLikeItemId?.trim() === itemId;
  const [liked, setLiked] = useState(initiallyLiked || pendingLike);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [pendingOptimistic, setPendingOptimistic] = useState(false);
  const syncedItemRef = useRef(itemId);
  const localOverrideRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (syncedItemRef.current !== itemId) {
      syncedItemRef.current = itemId;
      localOverrideRef.current = null;
      setLiked(initiallyLiked || pendingLike);
      setPendingOptimistic(false);
      setSaveSheetOpen(false);
      return;
    }
    if (pendingLike) {
      localOverrideRef.current = true;
      setLiked(true);
      return;
    }
    if (localOverrideRef.current === null) {
      setLiked(initiallyLiked);
    }
  }, [itemId, initiallyLiked, pendingLike]);

  const closeSaveSheet = useCallback(() => {
    setSaveSheetOpen(false);
    setLiked(false);
    setPendingOptimistic(false);
    localOverrideRef.current = null;
  }, []);

  const beginAuthForLike = useCallback(async () => {
    if (!itemId) return;
    await auth.setPostAuthResumeForLikeItem(itemId);
    setSaveSheetOpen(false);
  }, [auth, itemId]);

  const toggleLike = useCallback(async (): Promise<boolean> => {
    if (!itemId) return liked;
    if (!auth.isAuthenticated) {
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
      await setItemLike(itemId, next);
      return next;
    } catch {
      localOverrideRef.current = previous;
      setLiked(previous);
      return previous;
    }
  }, [auth.isAuthenticated, itemId, liked]);

  return {
    liked,
    saveSheetOpen,
    pendingOptimistic,
    toggleLike,
    closeSaveSheet,
    beginAuthForLike,
  };
}
