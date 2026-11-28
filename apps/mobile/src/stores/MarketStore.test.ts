import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMarketStates = vi.fn();
const readStoredMarket = vi.fn();
const writeStoredMarket = vi.fn();
const detectMarketLocation = vi.fn();

vi.mock('../utils/detectMarketCountry', () => ({
  detectMarketLocation: (...args: unknown[]) => detectMarketLocation(...args),
}));
vi.mock('../services/marketStatesApi', () => ({
  fetchMarketStates: (...args: unknown[]) => fetchMarketStates(...args),
}));
vi.mock('../utils/marketStorage', () => ({
  clearPromptDismissed: vi.fn(async () => undefined),
  readPromptDismissed: vi.fn(async () => null),
  readStoredMarket: (...args: unknown[]) => readStoredMarket(...args),
  writePromptDismissed: vi.fn(async () => undefined),
  writeStoredMarket: (...args: unknown[]) => writeStoredMarket(...args),
}));
vi.mock('../utils/marketAnalytics', () => ({
  trackMarketEvent: vi.fn(),
}));

import { MarketStore } from './MarketStore';

describe('MarketStore saved-state fallback', () => {
  beforeEach(() => {
    fetchMarketStates.mockReset();
    readStoredMarket.mockReset();
    writeStoredMarket.mockReset();
    detectMarketLocation.mockReset();
    writeStoredMarket.mockResolvedValue(undefined);
    detectMarketLocation.mockResolvedValue({ countryCode: 'CA', stateCode: 'ON' });
  });

  it('quietly falls back to All of the country when the loaded list omits the saved state', async () => {
    readStoredMarket.mockResolvedValue({
      countryCode: 'CA',
      stateCode: 'Ontario',
      mode: 'MANUAL',
    });
    fetchMarketStates.mockResolvedValue({
      states: [{ state: 'Quebec', itemCount: 91 }],
      totalItemCount: 91,
    });

    let resolveStates: (value: unknown) => void = () => undefined;
    fetchMarketStates.mockReturnValue(
      new Promise((resolve) => {
        resolveStates = resolve;
      })
    );

    const store = new MarketStore();
    await store.hydrate();
    expect(store.selectedCountryCode).toBe('CA');
    expect(store.selectedStateCode).toBe('Ontario');
    expect(fetchMarketStates).toHaveBeenCalledWith('CA', 'all');

    resolveStates({
      states: [{ state: 'Quebec', itemCount: 91 }],
      totalItemCount: 91,
    });
    await vi.waitFor(() => expect(store.selectedStateCode).toBeNull());
    expect(store.selectedCountryCode).toBe('CA');
    expect(store.selectedStateCode).toBeNull();
    expect(store.mode).toBe('MANUAL');
    expect(writeStoredMarket).toHaveBeenCalledWith({
      countryCode: 'CA',
      stateCode: null,
      mode: 'MANUAL',
    });
  });

  it('keeps ON when the list has Quebec and Ontario', async () => {
    readStoredMarket.mockResolvedValue({
      countryCode: 'CA',
      stateCode: 'ON',
      mode: 'AUTO',
    });
    fetchMarketStates.mockResolvedValue({
      states: [{ state: 'Quebec' }, { state: 'Ontario' }],
      totalItemCount: 100,
    });

    const store = new MarketStore();
    await store.hydrate();
    await vi.waitFor(() => expect(fetchMarketStates).toHaveBeenCalled());
    await vi.waitFor(() => expect(store.selectedStateCode).toBe('ON'));
    expect(writeStoredMarket).not.toHaveBeenCalled();
  });

  it('does not clear the saved state when market-states fails', async () => {
    readStoredMarket.mockResolvedValue({
      countryCode: 'CA',
      stateCode: 'Ontario',
      mode: 'MANUAL',
    });
    fetchMarketStates.mockRejectedValue(new Error('network'));

    const store = new MarketStore();
    await store.hydrate();
    await vi.waitFor(() => expect(fetchMarketStates).toHaveBeenCalled());
    expect(store.selectedStateCode).toBe('Ontario');
    expect(writeStoredMarket).not.toHaveBeenCalled();
  });
});
