import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../stores/RootStore';
import { setBusinessFollow } from '../services/businessFollowsApi';

export function useBusinessFollow(
  businessId: string | null | undefined,
  initiallyFollowing = false
) {
  const { auth } = useStore();
  const pendingFollow =
    !!businessId && auth.postAuthResumeFollowBusinessId?.trim() === businessId;
  const [following, setFollowing] = useState(initiallyFollowing || pendingFollow);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [pendingOptimistic, setPendingOptimistic] = useState(false);
  const syncedBusinessRef = useRef(businessId);
  const localOverrideRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (syncedBusinessRef.current !== businessId) {
      syncedBusinessRef.current = businessId;
      localOverrideRef.current = null;
      setFollowing(initiallyFollowing || pendingFollow);
      setPendingOptimistic(false);
      setSaveSheetOpen(false);
      return;
    }
    if (pendingFollow) {
      localOverrideRef.current = true;
      setFollowing(true);
      return;
    }
    if (localOverrideRef.current === null) {
      setFollowing(initiallyFollowing);
    }
  }, [businessId, initiallyFollowing, pendingFollow]);

  const closeSaveSheet = useCallback(() => {
    setSaveSheetOpen(false);
    setFollowing(false);
    setPendingOptimistic(false);
    localOverrideRef.current = null;
  }, []);

  const beginAuthForFollow = useCallback(async () => {
    if (!businessId) return;
    await auth.setPostAuthResumeForFollowBusiness(businessId);
    setSaveSheetOpen(false);
  }, [auth, businessId]);

  const toggleFollow = useCallback(async (): Promise<boolean> => {
    if (!businessId) return following;
    if (!auth.isAuthenticated) {
      setFollowing(true);
      setPendingOptimistic(true);
      setSaveSheetOpen(true);
      return true;
    }
    const previous = following;
    const next = !following;
    localOverrideRef.current = next;
    setFollowing(next);
    try {
      await setBusinessFollow(businessId, next);
      return next;
    } catch {
      localOverrideRef.current = previous;
      setFollowing(previous);
      return previous;
    }
  }, [auth.isAuthenticated, businessId, following]);

  return {
    following,
    saveSheetOpen,
    pendingOptimistic,
    toggleFollow,
    closeSaveSheet,
    beginAuthForFollow,
  };
}
