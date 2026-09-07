import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import fr from '../i18n/locales/fr.json';
import en from '../i18n/locales/en.json';
import {
  LANGUAGE_STORAGE_KEY,
  normalizeAppLanguage,
  resolveDefaultAppLanguage,
} from '../utils/resolveDefaultAppLanguage';

const getStoredLanguage = async (): Promise<string> => {
  try {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage === 'en' || storedLanguage === 'fr') {
      return storedLanguage;
    }
    return resolveDefaultAppLanguage();
  } catch {
    return resolveDefaultAppLanguage();
  }
};

const saveLanguage = async (language: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      normalizeAppLanguage(language)
    );
  } catch {
    // ignore
  }
};

const initializeI18n = async () => {
  try {
    if (i18n.isInitialized) {
      const storedLanguage = await getStoredLanguage();
      if (i18n.language !== storedLanguage) {
        await i18n.changeLanguage(storedLanguage);
      }
      return;
    }

    const storedLanguage = await getStoredLanguage();
    await i18n.use(initReactI18next).init({
      compatibilityJSON: 'v3',
      resources: {
        fr: { translation: fr },
        en: { translation: en },
      },
      lng: storedLanguage,
      fallbackLng: 'fr',
      debug: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      returnObjects: true,
    });

    if (i18n.language !== storedLanguage) {
      await i18n.changeLanguage(storedLanguage);
    }

    i18n.on('languageChanged', (lng) => {
      void saveLanguage(lng);
    });
  } catch (error) {
    console.error('Failed to initialize i18n:', error);
  }
};

void initializeI18n();

export const reloadTranslations = async () => {
  try {
    const frMod = await import('../i18n/locales/fr.json');
    const enMod = await import('../i18n/locales/en.json');
    i18n.addResourceBundle('fr', 'translation', frMod.default, true, true);
    i18n.addResourceBundle('en', 'translation', enMod.default, true, true);
    await i18n.changeLanguage(i18n.language);
  } catch (error) {
    console.error('Failed to reload translations:', error);
  }
};

export default i18n;
