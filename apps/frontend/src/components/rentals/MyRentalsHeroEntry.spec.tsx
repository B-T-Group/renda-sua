import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { MyRentalsHeroEntry } from './MyRentalsHeroEntry';

const mockNavigate = jest.fn();
const mockFlags = { rentals_my_rentals_entry_enabled: true };
const mockAuth = { isAuthenticated: true };
const mockBadge = { badge: '2' as string | null, count: 2 };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../hooks/useClientFlags', () => ({
  useClientFlags: () => ({ flags: mockFlags, loading: false }),
}));

jest.mock('../../contexts/SessionAuthContext', () => ({
  useSessionAuth: () => mockAuth,
}));

jest.mock('../../hooks/useClientRentalsTabBadge', () => ({
  useClientRentalsTabBadge: () => mockBadge,
}));

i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        rentals: {
          hub: { title: 'My rentals', titleCount: 'My rentals, {{count}} to do' },
        },
      },
    },
    fr: {
      translation: {
        rentals: {
          hub: { title: 'Mes locations', titleCount: 'Mes locations, {{count}} à faire' },
        },
      },
    },
  },
});

const theme = createTheme({ palette: { primary: { main: '#0A4FB5' } } });

function renderEntry() {
  return render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <MyRentalsHeroEntry />
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('MyRentalsHeroEntry', () => {
  beforeEach(async () => {
    mockNavigate.mockReset();
    mockFlags.rentals_my_rentals_entry_enabled = true;
    mockAuth.isAuthenticated = true;
    mockBadge.badge = '2';
    mockBadge.count = 2;
    await i18n.changeLanguage('en');
  });

  it('shows the caption and To do badge, and opens To do when the count is above 0', () => {
    renderEntry();
    expect(screen.getByTestId('rental-my-rentals-entry')).toBeTruthy();
    expect(screen.getByText('My rentals')).toBeTruthy();
    expect(screen.getByTestId('rental-my-rentals-badge').textContent).toBe('2');
    expect(screen.getByLabelText('My rentals, 2 to do')).toBeTruthy();
    fireEvent.click(screen.getByTestId('rental-my-rentals-entry'));
    expect(mockNavigate).toHaveBeenCalledWith('/rentals/requests?segment=action_needed');
  });

  it('hides a 0 badge and opens Upcoming', () => {
    mockBadge.badge = null;
    mockBadge.count = 0;
    renderEntry();
    expect(screen.queryByTestId('rental-my-rentals-badge')).toBeNull();
    expect(screen.getByLabelText('My rentals')).toBeTruthy();
    fireEvent.click(screen.getByTestId('rental-my-rentals-entry'));
    expect(mockNavigate).toHaveBeenCalledWith('/rentals/requests?segment=upcoming');
  });

  it('asks a signed-out renter to sign in by opening Upcoming My rentals', () => {
    mockAuth.isAuthenticated = false;
    mockBadge.badge = '2';
    mockBadge.count = 2;
    renderEntry();
    expect(screen.queryByTestId('rental-my-rentals-badge')).toBeNull();
    fireEvent.click(screen.getByTestId('rental-my-rentals-entry'));
    expect(mockNavigate).toHaveBeenCalledWith('/rentals/requests?segment=upcoming');
  });

  it('hides when the existing My rentals entry flag is off', () => {
    mockFlags.rentals_my_rentals_entry_enabled = false;
    renderEntry();
    expect(screen.queryByTestId('rental-my-rentals-entry')).toBeNull();
  });

  it('uses French copy', async () => {
    await i18n.changeLanguage('fr');
    renderEntry();
    expect(screen.getByText('Mes locations')).toBeTruthy();
    expect(screen.getByLabelText('Mes locations, 2 à faire')).toBeTruthy();
  });
});
