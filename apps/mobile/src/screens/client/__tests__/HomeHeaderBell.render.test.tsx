/** Bell sits beside the market pill on all four home lanes, not in the search row. */
import React from 'react';
import { Text, View } from 'react-native';
import { screen, within } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import ClientBrowseHomeScreen from '../ClientBrowseHomeScreen';
import GuestHomeScreen from '../../guest/GuestHomeScreen';

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockGetParent = jest.fn(() => ({ navigate: mockNavigate }));
let mockRouteName = 'ClientBrowse';
let mockRouteParams: { segment?: string } = { segment: 'shop' };
let mockIsAuthenticated = true;
let mockActivePersona: 'client' | 'guest' = 'client';
let mockUnreadCount = 0;
let mockAssistantLauncherOn = true;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    setParams: mockSetParams,
    setOptions: jest.fn(),
    getParent: mockGetParent,
  }),
  useRoute: () => ({ name: mockRouteName, params: mockRouteParams }),
}));

jest.mock('../../../stores/RootStore', () => ({
  useStore: () => ({
    auth: { isAuthenticated: mockIsAuthenticated },
    persona: { activePersona: mockActivePersona },
    cart: { lineCount: 0 },
  }),
}));

jest.mock('../../../hooks/useMarket', () => ({
  useMarket: () => ({
    selectedMarket: {
      id: 'CM',
      code: 'CM',
      countryCode: 'CM',
      stateCode: null,
      stateName: null,
      name: 'Cameroon',
      currency: 'XAF',
      flag: '🇨🇲',
      isEnabled: true,
    },
    markets: [],
    mode: 'MANUAL',
    detectedCountryCode: null,
    detectedStateCode: null,
    pendingPromptCountry: null,
    hydrated: true,
    setMarket: jest.fn(),
    acceptPrompt: jest.fn(),
    dismissPrompt: jest.fn(),
    backgroundDetect: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: mockUnreadCount }),
}));

jest.mock('../../../hooks/useClientOrders', () => ({
  useClientOrders: () => ({ orders: [], refresh: jest.fn() }),
}));

jest.mock('../../../hooks/useNearbyAgentsCount', () => ({
  useNearbyAgentsCount: () => ({ count: 0 }),
}));

jest.mock('../../../hooks/useActionsNeeded', () => ({
  useActionsNeeded: () => ({ items: [], dismissAll: jest.fn() }),
}));

jest.mock('../../../hooks/usePurchaseCredits', () => ({
  usePurchaseCredits: () => ({
    summary: {
      totalRemaining: 0,
      currency: 'XAF',
      nearestExpiry: null,
      primaryGrant: null,
    },
    usable: [],
  }),
}));

jest.mock('../../../hooks/usePostSignupCreditShopNavigation', () => ({
  usePostSignupCreditShopNavigation: jest.fn(),
}));

jest.mock('../../../hooks/useClientHomeOrderCta', () => ({
  useClientHomeOrderCta: () => ({ onPressCta: jest.fn(), busyOrderId: null }),
}));

jest.mock('../../../hooks/useCatalogVariantFlow', () => ({
  useCatalogVariantFlow: () => ({
    pickerItem: null,
    pickerOpen: false,
    closePicker: jest.fn(),
    onPickerConfirm: jest.fn(),
    requestBuy: jest.fn(),
    requestAddToCart: jest.fn(),
    confirmLabel: 'Continue',
  }),
}));

jest.mock('../../../navigation/tabBarGeometry', () => ({
  useTabBarGeometry: () => ({ tabBarOverlayHeight: 0 }),
}));

jest.mock('../../../contexts/ClientFlagsContext', () => ({
  useClientFlags: () => ({
    flags: {
      assistant_launcher_v1: mockAssistantLauncherOn,
      rentals_client_tab_enabled: true,
      rentals_search_first_enabled: true,
    },
  }),
}));

jest.mock('../../../components/assistant/launcher/launcherHooks', () => ({
  useClientFlagsResolved: () => true,
}));

jest.mock('../../../components/assistant/launcher/useAssistantEntryTap', () => ({
  useAssistantEntryTap: () => jest.fn(),
}));

jest.mock('../../../services/haptics', () => ({
  triggerHaptic: jest.fn(),
  hapticAllowed: () => false,
}));

jest.mock('expo-image', () => ({ Image: () => null }));

jest.mock('../../../components/client/BuyAgainCard', () => ({
  BuyAgainCard: () => null,
  buyAgainLines: () => [],
}));

jest.mock('../../../components/client/DiscoveryRails', () => ({
  DiscoveryRails: () => null,
}));

jest.mock('../../../components/common/ActionsNeededSection', () => ({
  ActionsNeededSection: () => null,
}));

jest.mock('../../../components/credits/StoreCreditsSnapshot', () => ({
  StoreCreditsSnapshot: () => null,
}));

jest.mock('../../../components/browse/CatalogVariantPickerDialog', () => ({
  CatalogVariantPickerDialog: () => null,
}));

jest.mock('../../../components/feedback/BottomOverlaySnackbar', () => ({
  BottomOverlaySnackbar: () => null,
}));

jest.mock('../../shared/BrowseCatalogScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    BrowseCatalogScreen: ({ headerTrailing }: { headerTrailing?: React.ReactNode }) => (
      <View testID="catalog-search-row">
        <Text>Search</Text>
        {headerTrailing}
      </View>
    ),
  };
});

jest.mock('../ClientRentalsHomeScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: () => (
      <View testID="rentals-home">
        <Text>Search cameras, tools, sound...</Text>
        <Text>My rentals</Text>
      </View>
    ),
  };
});

jest.mock('../../guest/GuestBrowseScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: () => (
      <View testID="guest-browse">
        <Text>Search</Text>
      </View>
    ),
  };
});

jest.mock('../../guest/GuestRentalsScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: () => (
      <View testID="guest-rentals">
        <Text>Search cameras, tools, sound...</Text>
      </View>
    ),
  };
});

const renderScreen = (ui: React.ReactElement) =>
  renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);

function resetClient({
  segment = 'shop',
  unread = 0,
  launcherOn = true,
}: {
  segment?: string;
  unread?: number;
  launcherOn?: boolean;
} = {}) {
  mockIsAuthenticated = true;
  mockActivePersona = 'client';
  mockRouteName = 'ClientBrowse';
  mockRouteParams = { segment };
  mockUnreadCount = unread;
  mockAssistantLauncherOn = launcherOn;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetClient();
});

function expectBellBesideMarket() {
  const cluster = screen.getByTestId('home-lane-header-market-cluster');
  expect(within(cluster).getByLabelText('Activity')).toBeTruthy();
  expect(within(cluster).getByLabelText('Selected market: Cameroon')).toBeTruthy();
  expect(screen.getByTestId('home-lane-header-bell-slot')).toBeTruthy();
}

describe('ClientBrowseHomeScreen header bell', () => {
  it.each([
    ['shop', 'catalog-my-orders'],
    ['food', 'catalog-my-orders'],
    ['exports', 'catalog-my-exports'],
  ] as const)(
    'puts the bell beside the market pill on %s, not in the search row',
    async (segment, shortcutTestId) => {
      resetClient({ segment });
      await renderScreen(<ClientBrowseHomeScreen />);
      expectBellBesideMarket();
      const search = screen.getByTestId('catalog-search-row');
      expect(within(search).queryByLabelText('Activity')).toBeNull();
      expect(within(search).getByTestId(shortcutTestId)).toBeTruthy();
      expect(within(search).getByLabelText('Open cart')).toBeTruthy();
    }
  );

  it('shows the bell on Rentals beside the market pill, with My rentals unchanged', async () => {
    resetClient({ segment: 'rentals' });
    await renderScreen(<ClientBrowseHomeScreen />);
    expectBellBesideMarket();
    expect(screen.getByTestId('rentals-home')).toBeTruthy();
    expect(screen.getByText('My rentals')).toBeTruthy();
    expect(screen.getByText('Search cameras, tools, sound...')).toBeTruthy();
    expect(screen.queryByTestId('catalog-search-row')).toBeNull();
    expect(screen.queryByTestId('catalog-search-trailing')).toBeNull();
  });

  it('keeps the unread accessibility hint on the header bell', async () => {
    resetClient({ unread: 3 });
    await renderScreen(<ClientBrowseHomeScreen />);
    const bell = within(screen.getByTestId('home-lane-header-market-cluster')).getByLabelText(
      'Activity'
    );
    expect(bell.props.accessibilityHint).toEqual('3 unread notifications');
  });

  it('keeps the assistant icon at the right edge, not in the market cluster', async () => {
    resetClient({ launcherOn: false });
    await renderScreen(<ClientBrowseHomeScreen />);
    expectBellBesideMarket();
    expect(screen.getByLabelText('Open AI assistant')).toBeTruthy();
    expect(
      within(screen.getByTestId('home-lane-header-market-cluster')).queryByLabelText(
        'Open AI assistant'
      )
    ).toBeNull();
  });

  it('hides the bell when the shopper is signed out', async () => {
    mockIsAuthenticated = false;
    await renderScreen(<ClientBrowseHomeScreen />);
    expect(screen.queryByLabelText('Activity')).toBeNull();
    expect(screen.getByLabelText('Selected market: Cameroon')).toBeTruthy();
  });
});

describe('GuestHomeScreen header', () => {
  it('does not show a notification bell on any guest lane', async () => {
    mockRouteName = 'GuestHome';
    mockRouteParams = { segment: 'shop' };
    await renderScreen(<GuestHomeScreen />);
    expect(screen.queryByLabelText('Activity')).toBeNull();
    expect(screen.queryByTestId('home-lane-header-bell-slot')).toBeNull();
    expect(screen.getByLabelText('Selected market: Cameroon')).toBeTruthy();
    expect(screen.getByTestId('guest-browse')).toBeTruthy();
  });
});
