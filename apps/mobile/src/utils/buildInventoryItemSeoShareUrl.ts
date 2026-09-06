import Constants from 'expo-constants';

import { getEnv } from '../config/auth0';

/**
 * Public link for previews and social shares (same contract as web
 * `buildInventoryItemSeoShareUrl`).
 */
export function buildInventoryItemSeoShareUrl(inventoryId: string): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const fromEnv = process.env.EXPO_PUBLIC_WEB_APP_ORIGIN?.trim();
  const fromExtra = extra.webAppOrigin?.trim();
  const web = (fromEnv || fromExtra)?.replace(/\/$/, '');
  if (web) {
    return `${web}/items/${inventoryId}/seo`;
  }
  const apiRoot = getEnv().apiUrl.replace(/\/$/, '');
  return `${apiRoot}/inventory-items/${inventoryId}/seo`;
}
