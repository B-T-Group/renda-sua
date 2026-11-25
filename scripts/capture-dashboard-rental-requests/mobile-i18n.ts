/** Capture-only i18n. Mobile stays on v3 plurals, matching the app. */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../apps/mobile/src/i18n/locales/en.json';
import fr from '../../apps/mobile/src/i18n/locales/fr.json';

const lang = (globalThis as { __LANG?: string }).__LANG === 'fr' ? 'fr' : 'en';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: lang,
    fallbackLng: lang,
    compatibilityJSON: 'v3',
    initImmediate: false,
    resources: { en: { translation: en }, fr: { translation: fr } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
