import { useCallback, useEffect, useState } from 'react';
import { hasSeenRestockHint, markRestockHintSeen } from '../utils/restockHintStorage';

/**
 * First-time hint, shown once under the first sold-out like. Persisted as seen
 * as soon as it is displayed, so it stays visible this session until dismissed
 * but never returns on a later visit.
 */
export function useRestockHint(wantsToShow: boolean) {
  const [visible, setVisible] = useState(false);
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    if (!wantsToShow || decided) return;
    let cancelled = false;
    void hasSeenRestockHint().then((seen) => {
      if (cancelled) return;
      setDecided(true);
      if (!seen) {
        setVisible(true);
        void markRestockHintSeen();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [wantsToShow, decided]);

  const dismiss = useCallback(() => {
    setVisible(false);
    void markRestockHintSeen();
  }, []);

  return { visible: visible && wantsToShow, dismiss };
}
