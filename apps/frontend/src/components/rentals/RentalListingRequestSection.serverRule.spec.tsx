import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { RentalListingRequestSection } from './RentalListingRequestSection';

const mockCreateRequest = jest.fn();
const mockApi = {
  createRequest: (...args: unknown[]) => mockCreateRequest(...args),
  fetchListingBookedWindows: jest.fn().mockResolvedValue([]),
};
const mockNavigate = jest.fn();

jest.mock('../../hooks/useRentalApi', () => ({ useRentalApi: () => mockApi }));
jest.mock('../../hooks/useClientFlags', () => ({
  useClientFlags: () => ({
    flags: { rentals_card_window_guard_enabled: false },
  }),
}));
jest.mock('../../hooks/useTrackSiteEvent', () => ({
  SITE_EVENT_ASSISTANT_RENTAL_REQUEST_CREATED: 'assistant_rental_request_created',
  useTrackSiteEvent: () => ({ trackSiteEvent: jest.fn() }),
}));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} }, fr: { translation: {} } },
  interpolation: { escapeValue: false },
});

const LEAD_EN = 'That start is now less than 2\u00A0h away. Pick a later time.';
const LEAD_FR = 'Ce début est maintenant dans moins de 2\u00A0h. Choisissez une heure plus tard.';
const weekly = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_available: true,
  start_time: '08:00:00',
  end_time: '18:00:00',
}));

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={createTheme()}>
        <RentalListingRequestSection
          listingId="listing-1"
          isAuthenticated
          weeklyAvailability={weekly}
          basePricePerHour={3000}
          basePricePerDay={27000}
          currency="XAF"
          minRentalHours={2}
          initialStartDate="2027-03-10"
          initialEndDate="2027-03-12"
          timeZone="Africa/Libreville"
          city="Libreville"
        />
      </ThemeProvider>
    </I18nextProvider>
  );
}

async function submitThroughConfirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  });
}

describe('RentalListingRequestSection: server refuses a day-and-hours rule on submit (R1)', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(async () => {
    mockCreateRequest.mockReset();
    mockNavigate.mockReset();
    await i18n.changeLanguage('en');
  });

  it('reopens the dialog with the red rule text and leaves no message on the page', async () => {
    mockCreateRequest.mockRejectedValue({ response: { status: 400, data: { code: 'RENTAL_LEAD_TIME', message: 'lead' } } });
    renderSection();
    await act(async () => undefined);
    await submitThroughConfirm();

    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    const alert = screen.getByTestId('day-hours-server-error');
    expect(alert.textContent).toBe(LEAD_EN);
    expect(within(screen.getByTestId('day-hours-sheet')).getByTestId('day-hours-server-error')).toBe(alert);
    // The only alert is the one inside the picker: nothing is left on the page behind it.
    expect(screen.getAllByRole('alert')).toEqual([alert]);
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull();
  });

  it('clears the red alert on the first change to the picked days (R4)', async () => {
    mockCreateRequest.mockRejectedValue({ response: { status: 400, data: { code: 'RENTAL_LEAD_TIME' } } });
    renderSection();
    await act(async () => undefined);
    await submitThroughConfirm();
    expect(screen.getByTestId('day-hours-server-error')).toBeTruthy();

    fireEvent.click(screen.getByTestId('day-hours-day-2027-03-12'));
    expect(screen.queryByTestId('day-hours-server-error')).toBeNull();
  });

  it('says it in French', async () => {
    await i18n.changeLanguage('fr');
    mockCreateRequest.mockRejectedValue({ response: { status: 400, data: { code: 'RENTAL_LEAD_TIME' } } });
    renderSection();
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    });
    expect(screen.getByTestId('day-hours-server-error').textContent).toBe(LEAD_FR);
  });

  it('keeps other server errors on the page, not in the picker', async () => {
    mockCreateRequest.mockRejectedValue({ response: { status: 500, data: { message: 'Something broke' } } });
    renderSection();
    await act(async () => undefined);
    await submitThroughConfirm();
    expect(screen.queryByTestId('day-hours-server-error')).toBeNull();
    expect(screen.getByText('Something broke')).toBeTruthy();
  });
});
