/** Capture-only i18n. The app's i18n module is redirected here and is not an app entry. */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';

const lang = (globalThis as { __LANG?: string }).__LANG === 'fr' ? 'fr' : 'en';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: lang,
    fallbackLng: lang,
    resources: { en: { translation: en }, fr: { translation: fr } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
