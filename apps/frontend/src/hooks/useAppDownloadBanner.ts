import { useCallback, useEffect, useState } from 'react';

const DISMISSED_KEY = 'rendasua_app_banner_dismissed';

export function useAppDownloadBanner() {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      setDismissed(stored === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }, []);

  return { dismissed, dismiss };
}
