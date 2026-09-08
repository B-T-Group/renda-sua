import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/storageKeys';
import StorageService from '../services/storage/StorageService';
import { getAppVersion } from '../utils/appVersion';
import {
  resolveStoreUpdatePrompt,
  type StoreUpdateMode,
  type StoreUpdatePrompt,
} from '../utils/resolveStoreUpdatePrompt';

export type { StoreUpdateMode };

export function useStoreUpdateGate() {
  const [prompt, setPrompt] = useState<StoreUpdatePrompt | null>(null);

  const evaluate = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      setPrompt(await resolveStoreUpdatePrompt(getAppVersion()));
    } catch {
      // Fail open — never block the app if the policy endpoint is down.
    }
  }, []);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void evaluate();
    });
    return () => sub.remove();
  }, [evaluate]);

  const dismiss = useCallback(async () => {
    if (!prompt || prompt.mode === 'force') return;
    await StorageService.setString(
      STORAGE_KEYS.storeUpdateDismissedRecommended,
      prompt.targetVersion
    );
    setPrompt(null);
  }, [prompt]);

  return {
    visible: prompt != null,
    mode: prompt?.mode ?? null,
    dismiss,
  };
}
