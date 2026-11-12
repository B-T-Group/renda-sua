import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../apps/frontend/src/theme/theme';
import RentalBookingDetailPage from '../../apps/frontend/src/components/pages/RentalBookingDetailPage';
import AdminInspectionDisputesPage from '../../apps/frontend/src/components/pages/AdminInspectionDisputesPage';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';
import {
  buildRentalNotReceivedNotice,
  buildRentalNotReceivedSupportNotice,
} from '../../apps/backend/src/notifications/rental-push.messages';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function Mail({ subject, body, extra }: { subject: string; body: string; extra?: string }) {
  return (
    <Box sx={{ maxWidth: 560, m: 2, p: 3, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary">
        Subject
      </Typography>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {subject}
      </Typography>
      <Typography>{body}</Typography>
      {extra ? <Typography sx={{ mt: 2 }}>{extra}</Typography> : null}
    </Box>
  );
}

function PushCard({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ maxWidth: 360, m: 2, p: 2, bgcolor: '#1c1c1e', borderRadius: 3 }}>
      <Typography variant="caption" sx={{ color: '#d1d1d6' }}>
        RendaSua
      </Typography>
      <Typography sx={{ color: '#fff', fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ color: '#f2f2f7', mt: 0.5 }}>{body}</Typography>
    </Box>
  );
}

function Notice() {
  const params = new URLSearchParams(window.location.search);
  const language = params.get('lang') === 'fr' ? 'fr' : 'en';
  const kind = params.get('kind') ?? 'business-email';
  const business = buildRentalNotReceivedNotice({ preferredLanguage: language });
  const support = buildRentalNotReceivedSupportNotice({
    bookingNumber: 'RB-104218',
    rentalItemName: 'Canon EOS R50',
    preferredLanguage: 'en',
  });
  if (kind === 'business-push') return <PushCard title={business.title} body={business.body} />;
  if (kind === 'support-email') {
    return <Mail subject={support.title} body={support.body} extra="Review it at /admin/rental-inspections." />;
  }
  return <Mail subject={business.title} body={business.body} />;
}

function CaptureApp() {
  const params = new URLSearchParams(window.location.search);
  const language = params.get('lang') === 'fr' ? 'fr' : 'en';
  const view = params.get('view') ?? 'renter';
  (window as Window & { __scene?: string }).__scene = 'started';
  document.documentElement.lang = language;
  if (i18n.language !== language) void i18n.changeLanguage(language);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {view === 'admin' ? (
          <MemoryRouter>
            <AdminInspectionDisputesPage />
          </MemoryRouter>
        ) : view === 'notice' ? (
          <Notice />
        ) : (
          <MemoryRouter initialEntries={['/rentals/bookings/b1']}>
            <Routes>
              <Route path="/rentals/bookings/:bookingId" element={<RentalBookingDetailPage />} />
            </Routes>
          </MemoryRouter>
        )}
      </ThemeProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
