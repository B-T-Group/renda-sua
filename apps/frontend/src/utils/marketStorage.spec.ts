import { MARKET_STORAGE_KEY } from '../types/market';
import { DETECTED_COUNTRY_STORAGE_KEY } from '../hooks/useDetectedCountry';
import {
  defaultMarketMode,
  readBootstrapCountryCode,
  readStoredMarket,
  writeStoredMarket,
} from './marketStorage';

describe('marketStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for missing, corrupt, or country-less payloads', () => {
    expect(readStoredMarket()).toBeNull();
    localStorage.setItem(MARKET_STORAGE_KEY, '{not-json');
    expect(readStoredMarket()).toBeNull();
    localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify({ mode: 'AUTO' }));
    expect(readStoredMarket()).toBeNull();
  });

  it('uppercases the country and defaults a missing mode to MANUAL', () => {
    localStorage.setItem(
      MARKET_STORAGE_KEY,
      JSON.stringify({ countryCode: 'ca', stateCode: 'QC' })
    );

    expect(readStoredMarket()).toEqual({
      countryCode: 'CA',
      stateCode: 'QC',
      mode: 'MANUAL',
    });
  });

  it('round-trips a written market and prefers it over IP detection', () => {
    writeStoredMarket({
      countryCode: 'ga',
      stateCode: null,
      mode: 'AUTO',
    });
    localStorage.setItem(DETECTED_COUNTRY_STORAGE_KEY, 'CM');

    expect(readStoredMarket()).toEqual({
      countryCode: 'GA',
      stateCode: null,
      mode: 'AUTO',
    });
    expect(readBootstrapCountryCode()).toBe('GA');
    expect(defaultMarketMode()).toBe('AUTO');
  });

  it('bootstraps from the detected country when no market is stored', () => {
    localStorage.setItem(DETECTED_COUNTRY_STORAGE_KEY, 'us');

    expect(readBootstrapCountryCode()).toBe('US');
    expect(defaultMarketMode()).toBe('AUTO');
  });
});
