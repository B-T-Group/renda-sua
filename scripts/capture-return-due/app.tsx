import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Box, Stack } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../apps/frontend/src/theme/theme';
import RentalBookingDetailPage from '../../apps/frontend/src/components/pages/RentalBookingDetailPage';
import AdminInspectionDisputesPage from '../../apps/frontend/src/components/pages/AdminInspectionDisputesPage';
import { ClientRentalRequestRowCard } from '../../apps/frontend/src/components/rentals/ClientRentalRequestRowCard';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';

const params = new URLSearchParams(window.location.search);
const frozen = params.get('now');
if (frozen) {
  const fixed = new Date(frozen).getTime();
  const RealDate = Date;
  window.Date = class extends RealDate {
    constructor(...args: ConstructorParameters<typeof RealDate>) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  } as DateConstructor;
}

const language = params.get('lang') === 'fr' ? 'fr' : 'en';
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const listing = {
  id: 'loc',
  base_price_per_hour: 1000,
  business_location: { name: "Stripe Rail - L'Assomption" },
  rental_item: { name: 'JBL PartyBox 310', currency: 'XAF' },
};

function Cards() {
  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, bgcolor: '#FAF9F7', minHeight: '100vh' }}>
      <ClientRentalRequestRowCard
        row={{
          id: 'req-overdue',
          status: 'booked',
          created_at: '2026-11-10T10:00:00.000Z',
          rental_location_listing: listing,
          rental_booking: {
            id: 'overdue',
            status: 'awaiting_return',
            end_at: '2026-11-12T19:00:00.000Z',
            renter_reported_returned_at: null,
          },
        }}
        bookingLoading={false}
        onBookRequest={() => undefined}
        onCancel={() => undefined}
        onViewListing={() => undefined}
        onViewBooking={() => undefined}
      />
      <ClientRentalRequestRowCard
        row={{
          id: 'req-waiting',
          status: 'booked',
          created_at: '2026-11-10T11:00:00.000Z',
          rental_location_listing: listing,
          rental_booking: {
            id: 'waiting',
            status: 'awaiting_return',
            end_at: '2026-11-12T19:00:00.000Z',
            renter_reported_returned_at: '2026-11-12T18:42:00.000Z',
          },
        }}
        bookingLoading={false}
        onBookRequest={() => undefined}
        onCancel={() => undefined}
        onViewListing={() => undefined}
        onViewBooking={() => undefined}
      />
    </Stack>
  );
}

function CaptureApp() {
  const view = params.get('view') ?? 'renter';
  (window as Window & { __scene?: string }).__scene = view === 'business' ? 'waiting' : 'started';
  if (i18n.language !== language) void i18n.changeLanguage(language);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>
          <Box sx={{ bgcolor: '#FAF9F7', minHeight: '100vh' }}>
            {view === 'admin' ? (
              <MemoryRouter>
                <AdminInspectionDisputesPage />
              </MemoryRouter>
            ) : view === 'list' ? (
              <Cards />
            ) : (
              <MemoryRouter initialEntries={['/rentals/bookings/b1']}>
                <Routes>
                  <Route path="/rentals/bookings/:bookingId" element={<RentalBookingDetailPage />} />
                </Routes>
              </MemoryRouter>
            )}
          </Box>
        </SnackbarProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
