import i18n from 'i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

const ENGLISH_DEFAULT_REGIONS = new Set(['US', 'CA']);

const syncDocumentLang = (lng: string) => {
  const code = lng?.split('-')[0];
  document.documentElement.lang =
    code === 'en' || code === 'fr' ? code : 'fr';
};

function regionFromLocaleTag(tag: string | undefined | null): string | null {
  if (!tag) return null;
  const parts = tag.replace('_', '-').split('-');
  if (parts.length < 2) return null;
  return parts[parts.length - 1].toUpperCase();
}

/** Prefer English for Canada/USA when no explicit saved language exists. */
function convertDetectedLanguage(lng: string): string {
  const navigatorTag =
    typeof navigator !== 'undefined'
      ? navigator.language || navigator.languages?.[0]
      : undefined;
  const region =
    regionFromLocaleTag(lng) || regionFromLocaleTag(navigatorTag);
  if (region && ENGLISH_DEFAULT_REGIONS.has(region)) {
    return 'en';
  }
  const code = lng?.split(/[-_]/)[0]?.toLowerCase();
  return code === 'en' || code === 'fr' ? code : 'fr';
}

export const i18nInitPromise = i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    supportedLngs: ['en', 'fr'],
    load: 'languageOnly',
    ns: ['translation'],
    defaultNS: 'translation',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}.json',
    },
    detection: {
      order: ['localStorage', 'htmlTag', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage,
    },
    react: {
      useSuspense: false,
    },
  })
  .then(() => {
    syncDocumentLang(i18n.language);
  });

i18n.on('languageChanged', syncDocumentLang);

export default i18n;
