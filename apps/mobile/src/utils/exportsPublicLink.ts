import Constants from 'expo-constants';

/** Canonical host of the public origin page (/exports/{cc}). */
export const EXPORTS_CANONICAL_ORIGIN = 'https://rendasua.com';

export function exportsOriginPath(code: string): string {
  return `/exports/${code.trim().toLowerCase()}`;
}

/**
 * Link copied or shared from the Exports lane "From" view.
 * Production: https://rendasua.com/exports/{cc}. Other builds use their web origin.
 */
export function exportsShareUrl(code: string): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const web =
    process.env.EXPO_PUBLIC_WEB_APP_ORIGIN?.trim() ||
    extra.webAppOrigin?.trim() ||
    EXPORTS_CANONICAL_ORIGIN;
  return `${web.replace(/\/$/, '')}${exportsOriginPath(code)}`;
}
