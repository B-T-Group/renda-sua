import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import en from '../../../public/locales/en.json';
import fr from '../../../public/locales/fr.json';
import { theme } from '../../theme/theme';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import { BusinessDashboardRentalRequestCard } from './BusinessDashboardRentalRequestCard';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
  });
}

function request(): BusinessRentalRequestRow {
  const start = '2026-11-29T05:00:00.000Z';
  return {
    id: 'canon',
    created_at: '2026-11-26T12:00:00.000Z',
    status: 'pending',
    rental_selection_windows: [
      { billing: 'all_day', calendar_date: '2026-11-29', start_at: start, end_at: '2026-11-30T04:59:00.000Z' },
    ],
    rental_pricing_snapshot: { version: 4, currency: 'CAD', total: 90, securityDeposit: 0 },
    units_requested: 1,
    quoted_total: 90,
    requested_start_at: start,
    respond_by: '2026-11-27T12:00:00.000Z',
    dates_available: true,
    payment_rail: 'stripe',
    rental_location_listing: {
      id: 'listing-canon',
      base_price_per_hour: 12,
      base_price_per_day: 45,
      security_deposit_amount: 0,
      business_location: { name: 'Pulse Audio', address: { city: 'Toronto', country: 'CA' } },
      rental_item: {
        name: 'Canon EOS R8',
        currency: 'CAD',
        rental_category: { name: 'Cameras' },
        rental_item_images: [],
      },
    },
    client: { id: 'client-marie', user: { first_name: 'Marie', last_name: 'Dubois' } },
  };
}

describe('dashboard rental request card actions', () => {
  afterEach(() => cleanup());

  it('places Decline before Accept so Accept is last on the right', async () => {
    await i18n.changeLanguage('en');
    render(
      <ThemeProvider theme={theme}>
        <I18nextProvider i18n={i18n}>
          <BusinessDashboardRentalRequestCard request={request()} onAccept={() => undefined} onDecline={() => undefined} />
        </I18nextProvider>
      </ThemeProvider>
    );
    const decline = screen.getByTestId('rental-request-decline');
    const accept = screen.getByTestId('rental-request-accept');
    expect(decline.compareDocumentPosition(accept) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
