import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../stores/RootStore';
import {
  LANGUAGE_STORAGE_KEY,
  normalizeAppLanguage,
} from '../utils/resolveDefaultAppLanguage';

/**
 * Manages app language and syncs with i18n + AsyncStorage.
 */
export const useLanguage = () => {
  const { i18n } = useTranslation();
  const { auth } = useStore();
  const user = auth.user;
  const [currentLanguage, setCurrentLanguage] = useState(
    normalizeAppLanguage(i18n.language)
  );

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(normalizeAppLanguage(lng));
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (
          (storedLanguage === 'en' || storedLanguage === 'fr') &&
          storedLanguage !== currentLanguage
        ) {
          setCurrentLanguage(storedLanguage);
          if (i18n.language !== storedLanguage) {
            await i18n.changeLanguage(storedLanguage);
          }
        }
      } catch (error) {
        console.error('Failed to sync language:', error);
      }
    };

    void initializeLanguage();
  }, [currentLanguage, i18n]);

  const changeLanguage = async (language: string) => {
    try {
      const next = normalizeAppLanguage(language);
      await i18n.changeLanguage(next);
      setCurrentLanguage(next);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      return true;
    } catch (error) {
      console.error('Failed to change language:', error);
      return false;
    }
  };

  const getAvailableLanguages = () => [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
  ];

  return {
    currentLanguage,
    changeLanguage,
    getAvailableLanguages,
    isChanging: false,
    user,
  };
};

export default useLanguage;
