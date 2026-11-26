import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../../../../public/locales/en.json';
import fr from '../../../../../public/locales/fr.json';
import FirstRentalItemLocationStep from './FirstRentalItemLocationStep';

const mockFlags = { rentals_day_hours_picker_enabled: true };
const mockCreate = jest.fn();
const mockSnack = jest.fn();
const mockApi = {
  createBusinessRentalListing: (...a: unknown[]) => mockCreate(...a),
  publishBusinessRentalListing: jest.fn().mockResolvedValue({ success: true }),
  updateBusinessRentalItem: jest.fn().mockResolvedValue({ success: true }),
  fetchBusinessRentalItem: jest.fn().mockResolvedValue(null),
};
const mockLocs = {
  locations: [{ id: 'loc-1', name: 'Studio Akanda' }],
  primaryAddressCountry: 'GA',
  addLocation: jest.fn(),
  fetchLocations: jest.fn(),
  loading: false,
};
const mockInv = { businessLocations: [], fetchBusinessLocations: jest.fn(), loading: false };

jest.mock('../../../../hooks/useClientFlags', () => ({ useClientFlags: () => ({ flags: mockFlags }) }));
jest.mock('../../../../hooks/useRentalApi', () => ({ useRentalApi: () => mockApi }));
jest.mock('../../../../hooks/useBusinessLocations', () => ({ useBusinessLocations: () => mockLocs }));
jest.mock('../../../../hooks/useBusinessInventory', () => ({ useBusinessInventory: () => mockInv }));
jest.mock('../../../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({ profile: { business: { id: 'biz-1' } }, refetch: jest.fn() }),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockSnack }) }));
jest.mock('../../LocationModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../../ListingPreviewDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../rentals/WeeklyAvailabilityEditor', () => ({ __esModule: true, default: () => null }));

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, fr: { translation: fr } },
  interpolation: { escapeValue: false },
});

function renderStep(onComplete = jest.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={createTheme()}>
        <FirstRentalItemLocationStep item={{ id: 'item-1', name: 'Bosch GSB 18V drill' } as never} onComplete={onComplete} />
      </ThemeProvider>
    </I18nextProvider>
  );
  return onComplete;
}

const toggle = (key: 'offersDaily' | 'offersHourly') =>
  fireEvent.click(screen.getByTestId(`rental-mode-${key}`).querySelector('input') as HTMLInputElement);

describe('FirstRentalItemLocationStep: rent switches on web create (#866)', () => {
  beforeEach(async () => {
    mockFlags.rentals_day_hours_picker_enabled = true;
    mockCreate.mockReset().mockResolvedValue({ success: true, data: { id: 'lst-1' } });
    mockSnack.mockReset();
    await i18n.changeLanguage('en');
  });

  it('creates an hour-only listing: day price hidden, sent as 0, offers_daily false', async () => {
    const onComplete = renderStep();
    await act(async () => undefined);
    toggle('offersDaily');
    expect(screen.queryByTestId('first-rental-price-day')).toBeNull();
    fireEvent.change(screen.getByTestId('first-rental-price-hour'), { target: { value: '3000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish rental' }));
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ base_price_per_hour: 3000, base_price_per_day: 0, offers_daily: false, offers_hourly: true })
    );
    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('asks for a price for each switch that is on, instead of guessing 12 × hourly', async () => {
    renderStep();
    await act(async () => undefined);
    fireEvent.change(screen.getByTestId('first-rental-price-hour'), { target: { value: '3000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish rental' }));
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSnack).toHaveBeenCalledWith('Set a price for each way you rent.', { variant: 'warning' });
  });

  it('says it in French', async () => {
    await i18n.changeLanguage('fr');
    renderStep();
    await act(async () => undefined);
    expect(screen.getByText('Louer à la journée')).toBeTruthy();
    toggle('offersHourly');
    toggle('offersDaily');
    expect(screen.getByTestId('rental-mode-hint').textContent).toBe('Gardez au moins une option activée.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: fr.business.onboarding.firstRental.location.publish }));
    });
    expect(mockSnack).toHaveBeenCalledWith('Indiquez un prix pour chaque option activée.', { variant: 'warning' });
  });

  it('keeps the old step with the flag off: no switches, 12 × hourly, no offers sent', async () => {
    mockFlags.rentals_day_hours_picker_enabled = false;
    renderStep();
    await act(async () => undefined);
    expect(screen.queryByTestId('rental-mode-offersDaily')).toBeNull();
    fireEvent.change(screen.getByTestId('first-rental-price-hour'), { target: { value: '3000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish rental' }));
    });
    const body = mockCreate.mock.calls[0][0];
    expect(body).toEqual(expect.objectContaining({ base_price_per_hour: 3000, base_price_per_day: 36000 }));
    expect(body).not.toHaveProperty('offers_hourly');
  });
});
