import React from 'react';
import { bodyFor, sceneName } from './fixtures';

const http = {
  get: (url: string) => Promise.resolve({ data: bodyFor(url, 'GET', sceneName()) }),
  post: (url: string) => Promise.resolve({ data: bodyFor(url, 'POST', sceneName()) }),
  put: (url: string) => Promise.resolve({ data: bodyFor(url, 'PUT', sceneName()) }),
  patch: (url: string) => Promise.resolve({ data: bodyFor(url, 'PATCH', sceneName()) }),
  delete: (url: string) => Promise.resolve({ data: bodyFor(url, 'DELETE', sceneName()) }),
};

export function useApiClient() {
  return http;
}

const profile = { business: { id: 'biz-1' }, first_name: 'Sam', last_name: 'Nord' };

export function useUserProfileContext() {
  return { profile };
}

export function useOptionalUserProfileContext() {
  return { profile };
}

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  return children;
}

export function useSessionAuth() {
  return {
    isAuthenticated: true,
    user: { sub: 'user-1' },
    getAccessToken: async () => 'token',
    logout: async () => undefined,
  };
}

export function SessionAuthProvider({ children }: { children: React.ReactNode }) {
  return children;
}

const gql = {
  request: async () => ({ rental_categories: [{ id: 'cat-audio', name: 'Audio', slug: 'audio' }] }),
};

export function useGraphQLClient() {
  return { baseClient: gql, client: gql, isLoading: false, error: null };
}

export default useGraphQLClient;

export function useMarket() {
  return {
    selectedMarket: { countryCode: 'CA', stateCode: 'ON' },
    markets: [],
    mode: 'manual',
    hydrated: true,
    setMarket: () => undefined,
  };
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  return children;
}
