import { useCallback, useEffect, useState } from 'react';
import StorageService from '../services/storage/StorageService';

/** Load/persist a local dismiss flag (e.g. home tips). Hidden until storage resolves. */
export function usePersistedDismiss(storageKey: string | null) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!storageKey) {
      setDismissed(false);
      setReady(true);
      return;
    }
    void StorageService.getString(storageKey)
      .then((value) => {
        if (!cancelled) {
          setDismissed(value === '1');
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDismissed(false);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!storageKey) return;
    void StorageService.setString(storageKey, '1').catch(() => undefined);
  }, [storageKey]);

  return { visible: ready && !dismissed, dismiss };
}
