import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';
import { theme } from '../../apps/frontend/src/theme/theme';
import RentalsPage from '../../apps/frontend/src/components/pages/RentalsPage';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') === 'fr' ? 'fr' : 'en';
const scene = params.get('scene') || 'douala';
const query = scene === 'search' ? (lang === 'fr' ? 'appareil photo' : 'camera') : '';
const start = scene === 'search' ? '2026-11-22' : '';
const end = scene === 'search' ? '2026-11-25' : '';
const search = new URLSearchParams();
if (query) search.set('q', query);
if (scene === 'search') search.set('category', 'cameras');
if (start) search.set('start', start);
if (end) search.set('end', end);

class Boundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.stack || error.message };
  }

  render() {
    if (this.state.error) return <pre style={{ whiteSpace: 'pre-wrap', color: '#9b1c1c' }}>{this.state.error}</pre>;
    return this.props.children;
  }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: lang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
}).then(() => {
  createRoot(document.getElementById('root')!).render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[`/rentals?${search.toString()}`]}>
        <Boundary>
          <div style={{ minHeight: '100vh', background: '#FAF9F7' }}>
            <RentalsPage />
          </div>
        </Boundary>
      </MemoryRouter>
    </ThemeProvider>
  );
});
