import { STORAGE_KEYS } from '../constants/storageKeys';
import { fetchMobileVersionPolicy } from '../services/appVersionPolicyApi';
import StorageService from '../services/storage/StorageService';
import { compareAppVersions } from './compareAppVersions';

export type StoreUpdateMode = 'soft' | 'force';

export type StoreUpdatePrompt = {
  mode: StoreUpdateMode;
  targetVersion: string;
};

export async function resolveStoreUpdatePrompt(
  currentVersion: string
): Promise<StoreUpdatePrompt | null> {
  if (!currentVersion || currentVersion === '—') return null;
  const policy = await fetchMobileVersionPolicy();
  if (
    policy.minVersion &&
    compareAppVersions(currentVersion, policy.minVersion) < 0
  ) {
    return { mode: 'force', targetVersion: policy.minVersion };
  }
  const recommended = policy.recommendedVersion;
  if (!recommended || compareAppVersions(currentVersion, recommended) >= 0) {
    return null;
  }
  const dismissed = await StorageService.getString(
    STORAGE_KEYS.storeUpdateDismissedRecommended
  );
  if (dismissed === recommended) return null;
  return { mode: 'soft', targetVersion: recommended };
}
