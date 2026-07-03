import { useMemo } from 'react';

export interface AppStoreLinks {
  appStore: string;
  playStore: string;
  /** Primary store URL for the detected OS (appStore on iOS, playStore on Android, appStore on others) */
  primary: string;
  /** Secondary store URL */
  secondary: string;
  /** 'ios' | 'android' | 'other' */
  detectedOS: 'ios' | 'android' | 'other';
}

function detectOS(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

const APP_STORE_URL = 'https://apps.apple.com/ca/app/rendasua/id6760085423';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.rendasua.agent';

export function useAppStoreLinks(): AppStoreLinks {
  return useMemo(() => {
    const os = detectOS();
    const primary = os === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
    const secondary = os === 'android' ? APP_STORE_URL : PLAY_STORE_URL;
    return {
      appStore: APP_STORE_URL,
      playStore: PLAY_STORE_URL,
      primary,
      secondary,
      detectedOS: os,
    };
  }, []);
}

export { APP_STORE_URL, PLAY_STORE_URL };
