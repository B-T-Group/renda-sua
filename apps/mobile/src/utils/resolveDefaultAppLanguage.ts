import * as Localization from 'expo-localization';

export const LANGUAGE_STORAGE_KEY = '@BTGroupe:language';

const ENGLISH_DEFAULT_REGIONS = new Set(['US', 'CA']);

export type AppLanguage = 'en' | 'fr';

/**
 * Default app language from device locale.
 * Canada and USA default to English; otherwise use the device language if en/fr.
 */
export function resolveDefaultAppLanguage(): AppLanguage {
  const locales = Localization.getLocales?.() ?? [];
  const primary = locales[0];
  const region = primary?.regionCode?.toUpperCase();
  if (region && ENGLISH_DEFAULT_REGIONS.has(region)) {
    return 'en';
  }

  const languageCode = primary?.languageCode?.toLowerCase();
  if (languageCode === 'en') return 'en';
  if (languageCode === 'fr') return 'fr';
  return 'fr';
}

export function normalizeAppLanguage(
  code: string | null | undefined
): AppLanguage {
  if (!code) return resolveDefaultAppLanguage();
  return code.toLowerCase().startsWith('en') ? 'en' : 'fr';
}
