import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';
import { Gallery } from './gallery';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') === 'fr' ? 'fr' : 'en';
const screen = params.get('screen') ?? '01';

void i18n.use(initReactI18next).init({
  lng: lang,
  fallbackLng: 'en',
  resources: { en: { translation: en }, fr: { translation: fr } },
  interpolation: { escapeValue: false },
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <I18nextProvider i18n={i18n}>
      <Gallery screen={screen} lang={lang} />
    </I18nextProvider>
  );
}
