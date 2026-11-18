import React from 'react';
import { categoryBody, searchBody, shouldHang } from './catalog-api';

const MARKETS: Record<string, { name: string; stateName: string; stateCode: string; countryCode: string; currency: string }> = {
  toronto: { name: 'Toronto', stateName: 'Ontario', stateCode: 'ON', countryCode: 'CA', currency: 'CAD' },
  empty: { name: 'Yaoundé', stateName: 'Centre', stateCode: 'CE', countryCode: 'CM', currency: 'XAF' },
  douala: { name: 'Douala', stateName: 'Littoral', stateCode: 'LT', countryCode: 'CM', currency: 'XAF' },
};

function selectedMarket() {
  const scene = new URLSearchParams(window.location.search).get('scene') || 'douala';
  const picked = MARKETS[scene] ?? MARKETS.douala;
  return {
    id: `${picked.countryCode}:${picked.stateCode}`,
    code: picked.countryCode,
    ...picked,
    flag: '',
    isEnabled: true,
  };
}

export function useMarket() {
  const selected = selectedMarket();
  return {
    selectedMarket: selected,
    markets: [selected],
    mode: 'MANUAL' as const,
    hydrated: true,
    setMarket: () => undefined,
  };
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  return children;
}

export function useClientFlags() {
  return { flags: { rentals_default_list_enabled: true }, loaded: true };
}

export function useReorderOrder() {
  return { reorder: async () => ({}), loading: false };
}

const api = {
  get: async (url: string, config?: { params?: { q?: string; country_code?: string } }) => {
    if (shouldHang() && (url.includes('/rentals/search') || url.includes('/rentals/categories'))) {
      return new Promise(() => undefined);
    }
    if (url.includes('/rentals/categories')) return { data: categoryBody() };
    if (url.includes('/rentals/search')) return { data: searchBody(config?.params) };
    if (url.includes('client-flags')) {
      return { data: { success: true, data: { rentals_default_list_enabled: true } } };
    }
    return { data: { success: true, data: { listings: [], total: 0 } } };
  },
  post: async () => ({ data: { success: true } }),
};

export function useApiClient() {
  return api;
}

export const i18nInitPromise = Promise.resolve();
