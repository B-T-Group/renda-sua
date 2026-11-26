import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import en from '../../../public/locales/en.json';
import fr from '../../../public/locales/fr.json';
import { theme } from '../../theme/theme';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import { BusinessRentalRequestCard } from './BusinessRentalRequestCard';

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

function request(over: Partial<BusinessRentalRequestRow> = {}): BusinessRentalRequestRow {
  const start = '2026-11-26T20:00:00.000Z';
  return {
    id: 'partybox',
    created_at: '2026-11-26T12:00:00.000Z',
    status: 'pending',
    rental_selection_windows: [
      { billing: 'all_day', calendar_date: '2026-11-26', start_at: start, end_at: '2026-11-27T04:59:00.000Z' },
    ],
    rental_pricing_snapshot: { version: 4, currency: 'CAD', total: 90, securityDeposit: 0 },
    units_requested: 1,
    quoted_total: 90,
    requested_start_at: start,
    respond_by: '2026-11-26T18:00:00.000Z',
    respond_window: 'start',
    listing_timezone: 'America/Toronto',
    dates_available: true,
    payment_rail: 'stripe',
    rental_location_listing: {
      id: 'listing-party',
      base_price_per_hour: 12,
      base_price_per_day: 45,
      security_deposit_amount: 0,
      business_location: { name: 'Pulse Audio', address: { city: 'Toronto', country: 'CA' } },
      rental_item: {
        name: 'JBL PartyBox 310',
        currency: 'CAD',
        rental_category: { name: 'Speakers' },
        rental_item_images: [],
      },
    },
    client: { id: 'client-1', user: { first_name: 'MM', last_name: 'Test' } },
    ...over,
  };
}

function renderCard(row: BusinessRentalRequestRow) {
  return render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BusinessRentalRequestCard request={row} onAccept={() => undefined} onReject={() => undefined} />
        </MemoryRouter>
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('business rental request card — expired', () => {
  afterEach(() => cleanup());

  it('shows Accept and Decline on a pending request', async () => {
    await i18n.changeLanguage('en');
    renderCard(request());
    const decline = screen.getByTestId('rental-request-decline');
    const accept = screen.getByTestId('rental-request-accept');
    expect(decline.compareDocumentPosition(accept) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('rental-request-expired-state')).not.toBeInTheDocument();
  });

  it('hides actions and shows the expired state for a no_response request', async () => {
    await i18n.changeLanguage('en');
    renderCard(request({ status: 'unavailable', unavailable_reason_code: 'no_response', respond_window: 'start' }));
    expect(screen.getByTestId('rental-request-expired-state')).toBeInTheDocument();
    expect(screen.getByText('Request expired')).toBeInTheDocument();
    expect(screen.getByTestId('rental-request-expired-chip')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(screen.queryByText('Requested')).not.toBeInTheDocument();
    expect(
      screen.getByText("You didn’t reply before the start time. The renter can send a new request.")
    ).toBeInTheDocument();
    expect(screen.getByText('JBL PartyBox 310')).toBeInTheDocument();
    expect(screen.getByText(/Would have received/)).toBeInTheDocument();
    expect(screen.queryByTestId('rental-request-accept')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rental-request-decline')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing was charged/i)).not.toBeInTheDocument();
  });

  it('shows typographic French SLA copy on an expired 24h request', async () => {
    await i18n.changeLanguage('fr');
    renderCard(request({ status: 'unavailable', unavailable_reason_code: 'no_response', respond_window: 'sla' }));
    expect(screen.getByText('Demande expirée')).toBeInTheDocument();
    expect(screen.getByText('Expirée')).toBeInTheDocument();
    expect(screen.queryByText('Terminé')).not.toBeInTheDocument();
    expect(screen.getByText(/Vous auriez reçu/)).toBeInTheDocument();
    expect(screen.getByText(/Vous n’avez pas répondu sous 24/)).toBeInTheDocument();
    expect(i18n.t('business.dashboard.rentalRequests.expiredSlaReason')).toContain('24\u00a0h');
    expect(screen.queryByTestId('rental-request-accept')).not.toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('shows the frozen quote when snapshot lines are missing, not a live listing recomputation', async () => {
    await i18n.changeLanguage('en');
    renderCard(
      request({
        status: 'unavailable',
        unavailable_reason_code: 'no_response',
        quoted_total: 90,
        rental_pricing_snapshot: { version: 4, currency: 'CAD', total: 90, securityDeposit: 0 },
      })
    );
    expect(screen.getByText(/Would have received/)).toBeInTheDocument();
    expect(screen.getByText(/90/)).toBeInTheDocument();
    expect(screen.queryByText(/^\$45$/)).not.toBeInTheDocument();
  });
});
