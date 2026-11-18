import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../apps/frontend/src/theme/theme';
import BusinessRentalItemEditPage from '../../apps/frontend/src/components/pages/BusinessRentalItemEditPage';
import { RentalInspectionPanel } from '../../apps/frontend/src/components/rentals/RentalInspectionPanel';
import { useRentalInspection } from '../../apps/frontend/src/hooks/useRentalInspection';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';
import { booking, sceneName } from './fixtures';

const boot = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: boot,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const ITEM = new Set(['edit', 'explainer', 'explainer-momo', 'baseline']);

function CaptureApp() {
  const scene = sceneName();
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>
          {ITEM.has(scene) ? <ItemRoute /> : <InspectionRoute role={scene === 'review' ? 'client' : 'business'} />}
        </SnackbarProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

function ItemRoute() {
  return (
    <MemoryRouter initialEntries={['/business/rentals/items/item-1/edit']}>
      <Routes>
        <Route path="/business/rentals/items/:itemId/edit" element={<BusinessRentalItemEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function InspectionRoute({ role }: { role: 'client' | 'business' }) {
  return (
    <MemoryRouter>
      <InspectionHost role={role} />
    </MemoryRouter>
  );
}

function InspectionHost({ role }: { role: 'client' | 'business' }) {
  const row = booking();
  const model = useRentalInspection('b1', row);
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <RentalInspectionPanel bookingId="b1" role={role} booking={row} model={model} onChanged={() => undefined} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
