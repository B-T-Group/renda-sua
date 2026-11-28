import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MARKET_STORAGE_KEY } from '../types/market';

const mockGet = jest.fn();

jest.mock('../hooks/useApiClient', () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock('../hooks/useSupportedCountries', () => ({
  useSupportedCountries: () => ({
    countries: [
      {
        code: 'CA',
        name: 'Canada',
        currencyCode: 'CAD',
        serviceStatus: 'active',
        deliveryEnabled: true,
        supportedPaymentMethods: [],
      },
      {
        code: 'CM',
        name: 'Cameroon',
        currencyCode: 'XAF',
        serviceStatus: 'active',
        deliveryEnabled: true,
        supportedPaymentMethods: [],
      },
    ],
    supportedIsos: ['CA', 'CM'],
    loading: false,
  }),
}));

import { MarketProvider, useMarket } from './MarketContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MarketProvider>{children}</MarketProvider>
);

function storeMarket(countryCode: string, stateCode: string | null, mode: 'AUTO' | 'MANUAL') {
  localStorage.setItem(
    MARKET_STORAGE_KEY,
    JSON.stringify({ countryCode, stateCode, mode })
  );
}

describe('MarketProvider saved-state fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGet.mockReset();
  });

  it('quietly falls back to All of the country when the loaded list omits the saved state', async () => {
    storeMarket('CA', 'Ontario', 'MANUAL');
    mockGet.mockResolvedValue({
      data: { states: [{ state: 'Quebec', inventoryCount: 91, rentalCount: 5 }] },
    });

    const { result } = renderHook(() => useMarket(), { wrapper });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.selectedMarket?.countryCode).toBe('CA');

    await waitFor(() => expect(result.current.selectedMarket?.stateCode).toBeNull());

    expect(mockGet).toHaveBeenCalledWith('/locations/market-states', {
      params: { countryCode: 'CA', catalog: 'all' },
    });
    expect(result.current.selectedMarket?.countryCode).toBe('CA');
    expect(result.current.mode).toBe('MANUAL');
    expect(JSON.parse(localStorage.getItem(MARKET_STORAGE_KEY) ?? '{}')).toEqual({
      countryCode: 'CA',
      stateCode: null,
      mode: 'MANUAL',
    });
  });

  it('keeps a saved synonym (ON) when Ontario is in the list', async () => {
    storeMarket('CA', 'ON', 'AUTO');
    mockGet.mockResolvedValue({
      data: { states: [{ state: 'Quebec' }, { state: 'Ontario' }] },
    });

    const { result } = renderHook(() => useMarket(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current.selectedMarket?.stateCode).toBe('ON');
    expect(JSON.parse(localStorage.getItem(MARKET_STORAGE_KEY) ?? '{}').stateCode).toBe('ON');
  });

  it('does not clear the saved state when market-states fails', async () => {
    storeMarket('CA', 'Ontario', 'MANUAL');
    mockGet.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useMarket(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current.selectedMarket?.stateCode).toBe('Ontario');
    expect(JSON.parse(localStorage.getItem(MARKET_STORAGE_KEY) ?? '{}').stateCode).toBe(
      'Ontario'
    );
  });
});
