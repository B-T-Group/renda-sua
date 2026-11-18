import React from 'react';
import { categoryBody, searchBody, shouldHang } from './catalog-api';

const MARKETS: Record<string, { name: string; stateName: string; stateCode: string; countryCode: string; currency: string }> = {
  toronto: { name: 'Toronto', stateName: 'Ontario', stateCode: 'ON', countryCode: 'CA', currency: 'CAD' },
  empty: { name: 'Yaoundé', stateName: 'Centre', stateCode: 'CE', countryCode: 'CM', currency: 'XAF' },
  douala: { name: 'Douala', stateName: 'Littoral', stateCode: 'LT', countryCode: 'CM', currency: 'XAF' },
};

function market() {
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

export function ClientFlagsProvider({ children }: { children: React.ReactNode }) {
  return children;
}

export function useClientFlags() {
  return {
    flags: { rentals_default_list_enabled: true },
    loading: false,
    refresh: async () => undefined,
  };
}

export function useMarket() {
  const selected = market();
  return {
    selectedMarket: selected,
    markets: [selected],
    mode: 'MANUAL',
    hydrated: true,
    detectedCountryCode: selected.countryCode,
    detectedStateCode: selected.stateCode,
    pendingPromptCountry: null,
    setMarket: async () => undefined,
    acceptPrompt: async () => undefined,
    dismissPrompt: async () => undefined,
    backgroundDetect: async () => undefined,
  };
}

export function useStore() {
  return { auth: { isAuthenticated: false } };
}

export function useNavigation() {
  return { getParent: () => null, navigate: () => undefined, goBack: () => undefined };
}

export function useBottomTabBarHeight() {
  return 0;
}

export function getLocales() {
  const lang = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';
  return [{ languageCode: lang, regionCode: lang === 'fr' ? 'CM' : 'US' }];
}

export function NavigationContainer({ children }: { children: React.ReactNode }) {
  return children;
}

export async function publicApiGet(endpoint: string, params?: { q?: string; country_code?: string }) {
  if (shouldHang()) return new Promise(() => undefined);
  if (endpoint.includes('categories')) return categoryBody();
  if (endpoint.includes('search')) return searchBody(params);
  return { success: true, data: {} };
}

export async function publicApiPost() {
  return { success: true, data: {} };
}

const memory = new Map<string, string>();

const asyncStorage = {
  getItem: async (key: string) => {
    if (key.includes('language')) {
      return new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';
    }
    return memory.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: async (key: string) => {
    memory.delete(key);
  },
  clear: async () => memory.clear(),
  getAllKeys: async () => [...memory.keys()],
};

export default asyncStorage;
