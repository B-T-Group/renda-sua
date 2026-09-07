import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEV_OPTIONS_UNLOCK_KEY } from '../config/envSwitch';

const TAP_TARGET = 7;
const TAP_RESET_MS = 2500;

export function useDeveloperUnlock() {
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const tapCount = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(DEV_OPTIONS_UNLOCK_KEY).then((value) => {
      setUnlocked(value === '1');
      setHydrated(true);
    });
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  const unlock = useCallback(async () => {
    setUnlocked(true);
    await AsyncStorage.setItem(DEV_OPTIONS_UNLOCK_KEY, '1');
  }, []);

  const registerVersionTap = useCallback((): boolean => {
    if (unlocked) return false;
    clearResetTimer();
    tapCount.current += 1;
    if (tapCount.current >= TAP_TARGET) {
      tapCount.current = 0;
      void unlock();
      return true;
    }
    resetTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, TAP_RESET_MS);
    return false;
  }, [clearResetTimer, unlock, unlocked]);

  useEffect(() => () => clearResetTimer(), [clearResetTimer]);

  return { unlocked, hydrated, registerVersionTap };
}
