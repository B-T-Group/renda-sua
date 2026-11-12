import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import type { ClientRentalRequestRow } from '../../hooks/useRentalApi';
import { ClientRentalRequestRowCard } from './ClientRentalRequestRowCard';

const theme = createTheme();

i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        rentals: {
          bookNow: 'Book now',
          clientRequests: {
            requestedPeriod: 'Requested period',
            periodDayCount_one: '{{count}} day',
            periodDayCount_other: '{{count}} days',
            viewListing: 'View listing',
            unknownItem: 'Rental',
          },
          actions: { openBooking: 'Open booking' },
          phases: { offerReady: 'Offer ready', done: 'Done' },
          nextStep: { offerReadyClient: 'Book this offer to reserve your rental.' },
        },
      },
    },
    fr: {
      translation: {
        rentals: {
          bookNow: 'Réserver',
          clientRequests: {
            requestedPeriod: 'Période demandée',
            periodDayCount_one: '{{count}} jour',
            periodDayCount_other: '{{count}} jours',
            viewListing: "Voir l'annonce",
          },
          actions: { openBooking: 'Ouvrir la réservation' },
          phases: { offerReady: 'Offre prête' },
          nextStep: { offerReadyClient: 'Réservez cette offre.' },
        },
      },
    },
  },
});

function row(windows: ClientRentalRequestRow['rental_selection_windows'], status = 'available'): ClientRentalRequestRow {
  return {
    id: 'req-1',
    status,
    created_at: '2026-11-01T00:00:00.000Z',
    rental_selection_windows: windows,
    rental_location_listing: {
      id: 'listing-1',
      base_price_per_hour: 1000,
      base_price_per_day: 8000,
      business_location: { name: 'Akwa' },
      rental_item: { name: 'Scaffold', currency: 'XAF' },
    },
    rental_booking: status === 'booked' ? { id: 'book-1', status: 'confirmed' } : null,
  };
}

const day = (date: string) => ({
  billing: 'all_day' as const,
  calendar_date: date,
  start_at: `${date}T08:00:00.000Z`,
  end_at: `${date}T18:00:00.000Z`,
});

function renderCard(item: ClientRentalRequestRow, handlers?: Partial<Record<string, jest.Mock>>) {
  const onBookRequest = handlers?.onBookRequest ?? jest.fn();
  const onViewBooking = handlers?.onViewBooking ?? jest.fn();
  render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <ClientRentalRequestRowCard
          row={item}
          bookingLoading={false}
          onBookRequest={onBookRequest}
          onCancel={jest.fn()}
          onViewListing={jest.fn()}
          onViewBooking={onViewBooking}
        />
      </I18nextProvider>
    </ThemeProvider>
  );
  return { onBookRequest, onViewBooking };
}

describe('ClientRentalRequestRowCard period', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('shows one daily stay once and leaves Book now without an icon', () => {
    const { onBookRequest } = renderCard(row([day('2026-11-12'), day('2026-11-13'), day('2026-11-14')]));
    expect(screen.getByText('12–14 Nov · 3 days')).toBeInTheDocument();
    expect(screen.queryByText(/^1\./)).toBeNull();
    expect(screen.queryByText(/08:00/)).toBeNull();

    const book = screen.getByRole('button', { name: 'Book now' });
    expect(book.querySelector('svg')).toBeNull();
    expect(screen.getByRole('button', { name: 'View listing' }).querySelector('svg')).toBeNull();
    fireEvent.click(book);
    expect(onBookRequest).toHaveBeenCalledWith('req-1');
  });

  it('shows one hourly period with times', () => {
    renderCard(
      row([
        {
          billing: 'hourly',
          start_at: '2026-11-12T09:00:00.000Z',
          end_at: '2026-11-12T13:00:00.000Z',
        },
      ])
    );
    expect(screen.getByText('12 Nov · 09:00–13:00')).toBeInTheDocument();
    expect(screen.queryByText(/^1\./)).toBeNull();
  });

  it('numbers a multi-period request', () => {
    renderCard(
      row([
        { billing: 'hourly', start_at: '2026-11-12T09:00:00.000Z', end_at: '2026-11-12T13:00:00.000Z' },
        { billing: 'hourly', start_at: '2026-11-14T15:00:00.000Z', end_at: '2026-11-14T18:00:00.000Z' },
      ])
    );
    expect(screen.getByText('1. 12 Nov · 09:00–13:00')).toBeInTheDocument();
    expect(screen.getByText('2. 14 Nov · 15:00–18:00')).toBeInTheDocument();
    expect(screen.queryByText('12 Nov · 09:00–13:00, 14 Nov · 15:00–18:00')).toBeNull();
  });

  it('localizes a single daily period in French', async () => {
    await i18n.changeLanguage('fr');
    renderCard(row([day('2026-11-12')]));
    expect(screen.getByText('12 nov. · 1 jour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réserver' })).toBeInTheDocument();
  });

  it('still opens the booking from a booked request', () => {
    const { onViewBooking } = renderCard(row([day('2026-11-12')], 'booked'));
    fireEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    expect(onViewBooking).toHaveBeenCalledWith('book-1');
    expect(screen.queryByRole('button', { name: 'Book now' })).toBeNull();
  });
});
