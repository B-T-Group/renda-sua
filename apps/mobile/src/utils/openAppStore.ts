import { Linking, Platform } from 'react-native';

/** Store listings for com.rendasua.agent (ASC app id 6760085423). */
const IOS_APP_STORE_URL =
  'https://apps.apple.com/app/rendasua/id6760085423';
const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.rendasua.agent';

export function getAppStoreUrl(): string {
  return Platform.OS === 'ios' ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
}

export async function openAppStore(): Promise<boolean> {
  const url = getAppStoreUrl();
  try {
    if (!(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
