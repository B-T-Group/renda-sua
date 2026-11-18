import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../apps/mobile/src/i18n/locales/en.json';
import fr from '../../apps/mobile/src/i18n/locales/fr.json';

const lang = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: lang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
