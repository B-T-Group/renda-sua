import { useEffect, useSyncExternalStore } from 'react';
import {
  acquireLauncherSuppression,
  launcherSuppressionCount,
  subscribeLauncherSuppression,
} from './launcherSignals';

/** Call from any modal / bottom sheet / drawer: hides the assistant launcher while `active`. */
export function useLauncherSuppressor(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    return acquireLauncherSuppression();
  }, [active]);
}

export function useLauncherSuppressed(): boolean {
  return useSyncExternalStore(subscribeLauncherSuppression, () => launcherSuppressionCount() > 0);
}
