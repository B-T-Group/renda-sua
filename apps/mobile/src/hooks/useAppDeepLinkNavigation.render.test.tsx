/**
 * Renders the real useAppDeepLinkNavigation hook with a fake navigation ref and
 * stores to cover cold start (getInitialURL) and warm start (url event) links.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAppDeepLinkNavigation } from './useAppDeepLinkNavigation';

const STORE_ID = '82ed50dc-396a-4887-9b22-50b2d419f67c';
const ITEM_ID = '333d0d21-440a-4fe6-8449-00f5120aaca5';

type Nav = {
  ready: boolean;
  routeNames: string[];
  dispatch: jest.Mock;
};
const mockNav: Nav = { ready: false, routeNames: [], dispatch: jest.fn() };

jest.mock('../navigation/rootNavigationRef', () => {
  const fakeRef = {
    isReady: () => mockNav.ready,
    getRootState: () => (mockNav.ready ? { routeNames: mockNav.routeNames } : undefined),
    dispatch: (...args: unknown[]) => mockNav.dispatch(...args),
  };
  return {
    rootNavigationRef: fakeRef,
    navigateToOrderFromPush: jest.fn(() => true),
    navigateToAdminOrderFromPush: jest.fn(() => true),
    navigateToWhatsAppInboxFromPush: jest.fn(() => true),
    navigateToDocumentsFromPush: jest.fn(() => true),
    navigateToItemAiProposalFromPush: jest.fn(() => true),
    resetToPersonaDashboard: jest.fn(() => {
      mockNav.dispatch({ type: 'RESET_TO_DASHBOARD' });
    }),
    navigateToInventoryItemFromPush: (inventoryItemId: string) => {
      if (!mockNav.ready || !mockNav.routeNames.includes('InventoryItemDetail')) return false;
      mockNav.dispatch({
        type: 'NAVIGATE',
        payload: { name: 'InventoryItemDetail', params: { inventoryItemId } },
      });
      return true;
    },
  };
});
jest.mock('../navigation/restockNavigation', () => ({
  restockRoutesReady: jest.fn(() => true),
  openRestockTarget: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../config/auth0', () => ({
  getEnv: () => ({ apiUrl: 'https://prod.api.rendasua.com/api' }),
}));

type FakeStore = {
  auth: { isAuthenticated: boolean; tokens: { accessToken: string } | null };
  persona: {
    showMainApp: boolean;
    activePersona: 'client' | 'agent' | 'business';
    activeContext: unknown;
    isDelegationContext: boolean;
    personas: string[];
    pickingPersona: null;
    selectPersona: jest.Mock;
  };
};
let mockStore: FakeStore;
jest.mock('../stores/RootStore', () => ({ useStore: () => mockStore }));

function freshStore(signedIn: boolean, persona: FakeStore['persona']['activePersona'] = 'client') {
  mockStore = {
    auth: {
      isAuthenticated: signedIn,
      tokens: signedIn ? { accessToken: 'tok' } : null,
    },
    persona: {
      showMainApp: signedIn,
      activePersona: persona,
      activeContext: signedIn ? { kind: 'persona', persona } : null,
      isDelegationContext: false,
      personas: ['client', 'business'],
      pickingPersona: null,
      selectPersona: jest.fn(async () => undefined),
    },
  };
}

let urlListener: ((e: { url: string }) => void) | null = null;

function mountNav(routeNames: string[]) {
  mockNav.ready = true;
  mockNav.routeNames = routeNames;
}

const CLIENT_ROUTES = ['ClientMainTabs', 'StoreDetail', 'InventoryItemDetail'];
const GUEST_ROUTES = ['GuestTabs', 'StoreDetail', 'InventoryItemDetail'];
const BUSINESS_ROUTES = ['BusinessMainTabs', 'StoreDetail', 'BusinessItemDetail'];

function navigated() {
  return mockNav.dispatch.mock.calls.map((c) => c[0]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNav.ready = false;
  mockNav.routeNames = [];
  mockNav.dispatch = jest.fn();
  urlListener = null;
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((_: string, cb: never) => {
    urlListener = cb;
    return { remove: jest.fn() };
  }) as never);
});

describe('store share link', () => {
  const url = `https://rendasua.com/store/${STORE_ID}`;

  it('cold start (signed in): opens StoreDetail once the shell mounts, never the dashboard', async () => {
    freshStore(true);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
    mountNav(CLIENT_ROUTES);
    await renderHook(() => useAppDeepLinkNavigation(true));
    await waitFor(() => expect(mockNav.dispatch).toHaveBeenCalled());
    expect(navigated()).toHaveLength(1);
    expect(navigated()[0]).toMatchObject({
      type: 'NAVIGATE',
      payload: { name: 'StoreDetail', params: { businessId: STORE_ID } },
    });
    expect(navigated()).not.toContainEqual({ type: 'RESET_TO_DASHBOARD' });
  });

  it('cold start (signed in): waits for the persona gate, then opens the store', async () => {
    freshStore(true);
    mockStore.persona.showMainApp = false;
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
    mountNav(CLIENT_ROUTES);
    const view = await renderHook(() => useAppDeepLinkNavigation(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockNav.dispatch).not.toHaveBeenCalled();
    mockStore.persona.showMainApp = true;
    await view.rerender({});
    await waitFor(() => expect(mockNav.dispatch).toHaveBeenCalledTimes(1));
    expect(navigated()[0].payload.name).toBe('StoreDetail');
  });

  it('warm start (signed in business): url event opens StoreDetail', async () => {
    freshStore(true, 'business');
    mountNav(BUSINESS_ROUTES);
    await renderHook(() => useAppDeepLinkNavigation(true));
    expect(urlListener).toBeTruthy();
    await act(async () => {
      urlListener?.({ url: `${url}/?utm=wa` });
    });
    await waitFor(() => expect(mockNav.dispatch).toHaveBeenCalledTimes(1));
    expect(navigated()[0]).toMatchObject({
      payload: { name: 'StoreDetail', params: { businessId: STORE_ID } },
    });
  });

  it('cold start (guest): opens the store in the guest shell', async () => {
    freshStore(false);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
    mountNav(GUEST_ROUTES);
    await renderHook(() => useAppDeepLinkNavigation(true));
    await waitFor(() => expect(mockNav.dispatch).toHaveBeenCalledTimes(1));
    expect(navigated()[0].payload.name).toBe('StoreDetail');
  });
});

describe('public item link (/items/:id/seo)', () => {
  const url = `https://rendasua.com/items/${ITEM_ID}/seo`;

  it('cold start (signed-in client): opens InventoryItemDetail without persona switching', async () => {
    freshStore(true);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
    mountNav(CLIENT_ROUTES);
    await renderHook(() => useAppDeepLinkNavigation(true));
    await waitFor(() => expect(mockNav.dispatch).toHaveBeenCalledTimes(1));
    expect(navigated()[0]).toMatchObject({
      payload: { name: 'InventoryItemDetail', params: { inventoryItemId: ITEM_ID } },
    });
    expect(mockStore.persona.selectPersona).not.toHaveBeenCalled();
  });

  it('warm start (guest): opens InventoryItemDetail in the guest shell', async () => {
    freshStore(false);
    mountNav(GUEST_ROUTES);
    await renderHook(() => useAppDeepLinkNavigation(true));
    await act(async () => {
      urlListener?.({ url: `https://rendasua.com/items/${ITEM_ID}` });
    });
    await waitFor(() => expect(mockNav.dispatch).toHaveBeenCalledTimes(1));
    expect(navigated()[0].payload).toEqual({
      name: 'InventoryItemDetail',
      params: { inventoryItemId: ITEM_ID },
    });
  });

  it('business shell has no item detail: opens the web page in-app, no persona switch', async () => {
    freshStore(true, 'business');
    mountNav(BUSINESS_ROUTES);
    await renderHook(() => useAppDeepLinkNavigation(true));
    await act(async () => {
      urlListener?.({ url });
    });
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      `https://rendasua.com/items/${ITEM_ID}/seo`
    );
    expect(mockNav.dispatch).not.toHaveBeenCalled();
    expect(mockStore.persona.selectPersona).not.toHaveBeenCalled();
  });

  it('ignores non-shareable item routes (place_order)', async () => {
    freshStore(true);
    mountNav(CLIENT_ROUTES);
    await renderHook(() => useAppDeepLinkNavigation(true));
    await act(async () => {
      urlListener?.({ url: `https://rendasua.com/items/${ITEM_ID}/place_order` });
    });
    expect(mockNav.dispatch).not.toHaveBeenCalled();
  });
});
