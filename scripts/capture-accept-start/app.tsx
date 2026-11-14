import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { theme } from '../../apps/frontend/src/theme/theme';
import RentalBookingDetailPage from '../../apps/frontend/src/components/pages/RentalBookingDetailPage';
import RentalRequestSubmittedPage from '../../apps/frontend/src/components/pages/RentalRequestSubmittedPage';
import { ReportSentConfirmation } from '../../apps/frontend/src/components/rentals/ReportSentConfirmation';
import { RentalStartedConfirmation } from '../../apps/frontend/src/components/rentals/RentalStartedConfirmation';
import { formatConfirmationDue, formatConfirmationMoney } from '../../apps/frontend/src/utils/rentals/confirmationFormat';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';

const bootLang = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: bootLang,
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
  const direct = scene === 'reportSent' || scene === 'rentalStarted' || scene === 'momoStarted' || scene === 'push';
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {direct ? (
          <Box sx={{ bgcolor: '#FAF9F7', minHeight: '100vh', py: 4 }}>
            <Box sx={{ maxWidth: 720, mx: 'auto', px: 3 }}>
              <WebConfirmation scene={scene} language={language} />
            </Box>
          </Box>
        ) : (
          <MemoryRouter
            initialEntries={[
              scene === 'requestSubmitted'
                ? '/rentals/request-submitted?requestId=req-1'
                : '/rentals/bookings/b1',
            ]}
          >
            <Routes>
              <Route path="/rentals/bookings/:bookingId" element={<RentalBookingDetailPage />} />
              <Route path="/rentals/request-submitted" element={<RentalRequestSubmittedPage />} />
            </Routes>
          </MemoryRouter>
        )}
      </ThemeProvider>
    </I18nextProvider>
  );
}

const PHOTOS = [
  { id: '1', role: 'overview', url: '/hero-jbl.png' },
  { id: '2', role: 'other_side', url: '/hero-jbl.png' },
  { id: '3', role: 'accessories', url: '/hero-jbl.png' },
];

function WebConfirmation({ scene, language }: { scene: string; language: string }) {
  const when = formatConfirmationDue('2026-11-17T15:32:00.000Z', 'America/Toronto', language);
  const due = formatConfirmationDue('2026-11-19T01:00:00.000Z', 'America/Toronto', language);
  const momoDue = formatConfirmationDue('2026-11-18T19:00:00.000Z', 'Africa/Douala', language);
  const zone = language === 'fr' ? 'heure de Montréal' : 'Montréal time';
  const douala = language === 'fr' ? 'heure de Douala' : 'Douala time';
  if (scene === 'reportSent') {
    return (
      <ReportSentConfirmation
        stage="pickup"
        renterName="Amina"
        unitCount={1}
        versionNo={1}
        when={when}
        photos={PHOTOS}
        canEdit
        onBack={() => undefined}
        onEdit={() => undefined}
      />
    );
  }
  if (scene === 'push') return <WebNotice language={language} due={due} />;
  return (
    <RentalStartedConfirmation
      momo={scene === 'momoStarted'}
      due={scene === 'momoStarted' ? momoDue : due}
      zone={scene === 'momoStarted' ? douala : zone}
      paid={formatConfirmationMoney(scene === 'momoStarted' ? 45000 : 45, scene === 'momoStarted' ? 'XAF' : 'CAD', language)}
      deposit={formatConfirmationMoney(scene === 'momoStarted' ? 10000 : 20, scene === 'momoStarted' ? 'XAF' : 'CAD', language)}
      title="JBL PartyBox 310"
      startAt="2026-11-17T15:00:00.000Z"
      endAt={scene === 'momoStarted' ? '2026-11-18T19:00:00.000Z' : '2026-11-19T01:00:00.000Z'}
      location={scene === 'momoStarted' ? 'Sono Akwa – Akwa, Douala' : "Stripe Rail – L'Assomption"}
      onBack={() => undefined}
    />
  );
}

function WebNotice({ language, due }: { language: string; due: string }) {
  const french = language === 'fr';
  const acceptedTitle = french ? 'État des lieux accepté' : 'Condition report accepted';
  const acceptedBody = french
    ? "Le client a accepté l'état des lieux de JBL PartyBox 310."
    : 'The renter accepted the condition report for JBL PartyBox 310.';
  const startedTitle = french ? 'Location démarrée' : 'Rental started';
  const startedBody = french
    ? `Amina a accepté l'état des lieux. JBL PartyBox 310 est désormais en cours jusqu'au ${due}.`
    : `Amina accepted the condition report. JBL PartyBox 310 is now in progress until ${due}.`;
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Typography variant="overline" color="text.secondary">{french ? "À l'acceptation" : 'On accept'}</Typography>
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 2, border: '1px solid #E6E1D8' }}>
        <Typography variant="h6" fontWeight={800} color="#0B7A3B">{acceptedTitle}</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>{acceptedBody}</Typography>
      </Box>
      <Typography variant="overline" color="text.secondary">{french ? 'Quand la location est active' : 'When the rental is active'}</Typography>
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 2, border: '1px solid #E6E1D8' }}>
        <Typography variant="h6" fontWeight={800}>{startedTitle}</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>{startedBody}</Typography>
      </Box>
    </Box>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
