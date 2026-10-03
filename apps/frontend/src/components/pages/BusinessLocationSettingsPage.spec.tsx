import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { theme } from '../../theme/theme';
import { BusinessLocation } from '../../hooks/useBusinessLocations';
import BusinessLocationSettingsPage from './BusinessLocationSettingsPage';

const mockUpdateLocation = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({ locationId: 'loc-1' }),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({
    profile: { business: { id: 'biz-1' } },
  }),
}));

jest.mock('../../hooks/useBusinessCatalogScope', () => ({
  useBusinessCatalogScope: () => ({ isViewingOtherBusiness: false }),
}));

jest.mock('../../hooks/useIsStripeRail', () => ({
  useIsStripeRail: () => ({ isStripeRail: true, loading: false }),
}));

jest.mock('../../hooks/useBusinessLocations', () => ({
  selectBusinessLocation: (
    locations: BusinessLocation[],
    locationId?: string
  ) => locations.find((location) => location.id === locationId),
  useBusinessLocations: () => ({
    locations: [mockStripeLocation()],
    loading: false,
    updateLocation: mockUpdateLocation,
    deleteLocation: jest.fn(),
  }),
}));

jest.mock('../seo/SEOHead', () => () => null);
jest.mock('../business/location-settings/LocationExpectationsCard', () => () => null);
jest.mock('../business/location-settings/GettingPaidSection', () => () => null);
jest.mock('../business/location-settings/HowCustomersPaySection', () => () => null);
jest.mock('../business/location-settings/OrderAlertsSection', () => () => null);
jest.mock('../business/location-settings/BasicsSection', () => () => null);
jest.mock('../business/location-settings/MoreOptionsSection', () => () => null);
jest.mock('../business/location-settings/ForAllLocationsPanel', () => () => null);
jest.mock('../business/location-settings/OpenClosedSection', () => ({
  __esModule: true,
  default: ({
    location,
    updateLocation: save,
  }: {
    location: { id: string };
    updateLocation: (id: string, data: Record<string, unknown>) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        save(location.id, {
          operating_hours: { monday: { open: '09:00', close: '17:00' } },
        })
      }
    >
      Save hours
    </button>
  ),
}));

function mockStripeLocation(): BusinessLocation {
  return {
    id: 'loc-1',
    name: 'Akwa',
    address: {
      id: 'addr-1',
      address_line_1: 'Rue Joss',
      city: 'Douala',
      state: 'LT',
      postal_code: '',
      country: 'CA',
    },
    is_active: true,
    is_primary: true,
    location_type: 'store',
    created_at: '',
    updated_at: '',
    auto_withdraw_commissions: true,
  };
}

describe('BusinessLocationSettingsPage', () => {
  it('does not turn off Stripe auto-payout when saving opening hours', () => {
    mockUpdateLocation.mockReset();
    render(
      <ThemeProvider theme={theme}>
        <BusinessLocationSettingsPage />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(mockUpdateLocation).toHaveBeenCalledWith('loc-1', {
      operating_hours: { monday: { open: '09:00', close: '17:00' } },
    });
    expect(mockUpdateLocation.mock.calls[0][1]).not.toHaveProperty(
      'auto_withdraw_commissions'
    );
  });
});
