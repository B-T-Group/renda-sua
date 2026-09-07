import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  checkForUpdateManually,
  type ManualUpdateCheckResult,
} from './useExpoUpdatesOnStartup';

function messageForResult(result: ManualUpdateCheckResult, t: TFunction): string {
  switch (result.kind) {
    case 'unsupported':
      if (result.platform === 'web') {
        return t(
          'menuTab.updateUnavailableWeb',
          'Over-the-air updates are only available in the installed app (iOS or Android).'
        );
      }
      if (result.platform === 'dev') {
        return t(
          'menuTab.updateUnavailableDev',
          'Updates cannot be checked in development mode. Use a production build.'
        );
      }
      return t(
        'menuTab.updateUnavailableDisabled',
        'Updates are not enabled for this build.'
      );
    case 'up_to_date':
      return t('menuTab.updateUpToDate', 'You are on the latest version.');
    case 'reloading':
      return t('menuTab.updateReloading', 'Update downloaded. Restarting…');
    case 'error':
      return result.message === 'check_failed'
        ? t('menuTab.updateCheckFailed', 'Could not check for updates.')
        : result.message;
    default:
      return t('menuTab.updateCheckFailed', 'Could not check for updates.');
  }
}

export function useManualAppUpdateCheck() {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkForUpdateManually();
      setSnack(messageForResult(result, t));
    } finally {
      setChecking(false);
    }
  }, [t]);

  const dismissSnack = useCallback(() => setSnack(null), []);

  return { checking, runCheck, snack, dismissSnack };
}
