import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { theme } from '../../theme/theme';
import BusinessLocationsPage from './BusinessLocationsPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn(), closeSnackbar: jest.fn() }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({
    profile: { business: { id: 'biz-1' }, addresses: [] },
    loading: false,
    refetch: jest.fn(),
    addAddress: jest.fn(),
  }),
}));

jest.mock('../../hooks/useBusinessCatalogScope', () => ({
  useBusinessCatalogScope: () => ({ businessQueryParams: undefined }),
}));

jest.mock('../../hooks/useIsStripeRail', () => ({
  useIsStripeRail: () => ({ isStripeRail: false, loading: false }),
}));

jest.mock('../../hooks/useLocationTransfers', () => ({
  useLocationTransfers: () => ({ fetchPending: jest.fn() }),
}));

jest.mock('../../hooks/useBusinessLocations', () => ({
  useBusinessLocations: () => ({
    locations: [],
    primaryAddressCountry: 'CM',
    loading: false,
    error: null,
    warning: null,
    addLocation: jest.fn(),
    fetchLocations: jest.fn(),
  }),
}));

jest.mock('../business/LocationTransferInbox', () => () => null);
jest.mock('../business/LocationModal', () => () => null);
jest.mock('../dialogs/AddressDialog', () => () => null);
jest.mock('../seo/SEOHead', () => () => null);
jest.mock('../business/BusinessOrderTimingCard', () => () => (
  <div>Order confirmation timing</div>
));

describe('BusinessLocationsPage', () => {
  it('does not show order timing above the list and links to all-location settings', () => {
    render(
      <ThemeProvider theme={theme}>
        <BusinessLocationsPage />
      </ThemeProvider>
    );
    expect(screen.queryByText('Order confirmation timing')).not.toBeInTheDocument();
    expect(screen.getByText('For all your locations')).toBeInTheDocument();
  });
});
