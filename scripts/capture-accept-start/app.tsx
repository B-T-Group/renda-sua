import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../apps/frontend/src/theme/theme';
import RentalBookingDetailPage from '../../apps/frontend/src/components/pages/RentalBookingDetailPage';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function CaptureApp() {
  const params = new URLSearchParams(window.location.search);
  const language = params.get('lang') === 'fr' ? 'fr' : 'en';
  const scene = params.get('scene') ?? 'review';
  (window as Window & { __scene?: string }).__scene = scene;
  document.documentElement.lang = language;
  if (i18n.language !== language) void i18n.changeLanguage(language);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/rentals/bookings/b1']}>
          <Routes>
            <Route path="/rentals/bookings/:bookingId" element={<RentalBookingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
