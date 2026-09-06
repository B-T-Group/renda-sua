/**
 * i18n – device-aware default (CA/US → English), French elsewhere.
 * Stored preference in AsyncStorage wins when present.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';
import {
  LANGUAGE_STORAGE_KEY,
  normalizeAppLanguage,
  resolveDefaultAppLanguage,
  type AppLanguage,
} from '../utils/resolveDefaultAppLanguage';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
};

const defaultLanguage = resolveDefaultAppLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: 'fr',
  compatibilityJSON: 'v3',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

async function hydrateStoredLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored !== 'en' && stored !== 'fr') return;
    if (i18n.language !== stored) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Keep device-detected default.
  }
}

void hydrateStoredLanguage();

i18n.on('languageChanged', (lng) => {
  const normalized = normalizeAppLanguage(lng);
  void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, normalized).catch(() => {});
});

export default i18n;
export { defaultLanguage };
export type { AppLanguage };
