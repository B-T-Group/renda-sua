import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../../public/locales/en.json';
import fr from '../../../public/locales/fr.json';
import BusinessRentalsCatalogPage from './BusinessRentalsCatalogPage';

const mockFlags: { rentals_day_hours_picker_enabled: boolean } = { rentals_day_hours_picker_enabled: true };
const mockCreate = jest.fn();
const mockPublish = jest.fn();
const mockApi = {
  fetchBusinessRentalItems: jest.fn(),
  fetchBusinessRentalItem: jest.fn().mockResolvedValue(null),
  createBusinessRentalListing: (...a: unknown[]) => mockCreate(...a),
  publishBusinessRentalListing: (...a: unknown[]) => mockPublish(...a),
};
const mockLocations = { locations: [{ id: 'loc-1', name: 'Atelier Plateau' }] };

jest.mock('../../hooks/useClientFlags', () => ({ useClientFlags: () => ({ flags: mockFlags }) }));
jest.mock('../../hooks/useRentalApi', () => ({ useRentalApi: () => mockApi }));
jest.mock('../../hooks/useBusinessLocations', () => ({ useBusinessLocations: () => mockLocations }));
jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({ profile: { business: { id: 'biz-1' } } }),
}));
jest.mock('../rentals/BusinessRentalsStudioShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, fr: { translation: fr } },
  interpolation: { escapeValue: false },
});

const item = { id: 'item-1', name: 'Bosch GSB 18V drill', currency: 'CAD', rental_location_listings: [] };

async function openDialog() {
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={createTheme()}>
        <BusinessRentalsCatalogPage />
      </ThemeProvider>
    </I18nextProvider>
  );
  await act(async () => undefined);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('business.rentals.addListing') }));
  const dialog = screen.getByRole('dialog');
  // Pick the item and the location.
  fireEvent.mouseDown(within(dialog).getByLabelText(i18n.t('business.rentals.item')));
  fireEvent.click(await screen.findByRole('option', { name: item.name }));
  fireEvent.mouseDown(within(dialog).getAllByRole('combobox')[1]);
  fireEvent.click(await screen.findByRole('option', { name: 'Atelier Plateau' }));
  return dialog;
}

function type(testId: string, value: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

describe('BusinessRentalsCatalogPage: Add location listing with the rent switches (#866)', () => {
  beforeEach(async () => {
    mockFlags.rentals_day_hours_picker_enabled = true;
    mockApi.fetchBusinessRentalItems.mockResolvedValue([item]);
    mockCreate.mockReset().mockResolvedValue({ success: true, data: { id: 'lst-new' } });
    mockPublish.mockReset().mockResolvedValue({ success: true });
    await i18n.changeLanguage('en');
  });

  it('creates a day-only listing: hourly price hidden, sent as 0, offers_hourly false', async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('rental-mode-offersHourly').querySelector('input') as HTMLInputElement);
    expect(screen.queryByTestId('add-listing-price-hour')).toBeNull();
    expect(within(dialog).getByText(en.business.rentals.securityDepositCreateHintDaily)).toBeTruthy();
    const publish = screen.getByTestId('add-listing-publish');
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    type('add-listing-price-day', '40');
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      fireEvent.click(publish);
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ base_price_per_hour: 0, base_price_per_day: 40, offers_daily: true, offers_hourly: false })
    );
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('security_deposit_amount');
  });

  it('refuses turning the last switch off with "Keep at least one on." in red', async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('rental-mode-offersHourly').querySelector('input') as HTMLInputElement);
    fireEvent.click(within(dialog).getByTestId('rental-mode-offersDaily').querySelector('input') as HTMLInputElement);
    expect((within(dialog).getByTestId('rental-mode-offersDaily').querySelector('input') as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).getByTestId('rental-mode-hint').textContent).toBe('Keep at least one on.');
  });

  it('requires both prices when both switches are on (no 12 × hourly fallback)', async () => {
    await openDialog();
    type('add-listing-price-hour', '8');
    expect((screen.getByTestId('add-listing-publish') as HTMLButtonElement).disabled).toBe(true);
    type('add-listing-price-day', '40');
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-listing-publish'));
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ base_price_per_hour: 8, base_price_per_day: 40, offers_daily: true, offers_hourly: true })
    );
  });

  it('shows the switches in French', async () => {
    await i18n.changeLanguage('fr');
    const dialog = await openDialog();
    expect(within(dialog).getByText('Louer à la journée')).toBeTruthy();
    expect(within(dialog).getByText('Louer à l’heure')).toBeTruthy();
    fireEvent.click(within(dialog).getByTestId('rental-mode-offersDaily').querySelector('input') as HTMLInputElement);
    expect(screen.queryByTestId('add-listing-price-day')).toBeNull();
  });

  it('keeps the old dialog with the flag off: no switches, empty day price = 12 × hourly, no offers sent', async () => {
    mockFlags.rentals_day_hours_picker_enabled = false;
    const dialog = await openDialog();
    expect(within(dialog).queryByTestId('rental-mode-offersDaily')).toBeNull();
    type('add-listing-price-hour', '8');
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-listing-publish'));
    });
    const body = mockCreate.mock.calls[0][0];
    expect(body).toEqual(expect.objectContaining({ base_price_per_hour: 8, base_price_per_day: 96 }));
    expect(body).not.toHaveProperty('offers_daily');
    expect(body).not.toHaveProperty('offers_hourly');
  });
});
