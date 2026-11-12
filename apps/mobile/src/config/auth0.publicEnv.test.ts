import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnv } from './auth0';

const PUBLIC_ENV_KEYS = [
  'EXPO_PUBLIC_ENV',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_HASURA_URL',
  'EXPO_PUBLIC_AUTH0_DOMAIN',
  'EXPO_PUBLIC_AUTH0_CLIENT_ID',
  'EXPO_PUBLIC_AUTH0_AUDIENCE',
] as const;

function clearPublicEnv(): void {
  for (const key of PUBLIC_ENV_KEYS) {
    vi.stubEnv(key, '');
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getEnv public overrides', () => {
  it('stays on prod when no public env is set', () => {
    clearPublicEnv();

    const env = getEnv();

    expect(env.apiUrl).toBe('https://prod.api.rendasua.com/api');
    expect(env.hasuraUrl).toBe('https://hasura.rendasua.com/v1/graphql');
    expect(env.auth0Config.domain).toBe('rendasua-prod.ca.auth0.com');
    expect(env.stripePublishableKey.startsWith('pk_live_')).toBe(true);
  });

  it('selects the dev preset from EXPO_PUBLIC_ENV without MANUAL_ENV', () => {
    clearPublicEnv();
    vi.stubEnv('EXPO_PUBLIC_ENV', 'dev');

    const env = getEnv();

    expect(env.apiUrl).toBe('https://dev.api.rendasua.com/api');
    expect(env.hasuraUrl).toBe('https://hasura-dev.rendasua.com/v1/graphql');
    expect(env.auth0Config.domain).toBe('rendasua.ca.auth0.com');
    expect(env.auth0Config.clientId).toBe('KkXPODOPy753EuBeaFttZk148wyMkvJ4');
    expect(env.stripePublishableKey.startsWith('pk_test_')).toBe(true);
  });

  it('pins API, Hasura and Auth0 from EXPO_PUBLIC_* on top of prod', () => {
    clearPublicEnv();
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://dev.api.rendasua.com');
    vi.stubEnv('EXPO_PUBLIC_HASURA_URL', 'https://hasura-dev.rendasua.com/v1/graphql/');
    vi.stubEnv('EXPO_PUBLIC_AUTH0_DOMAIN', 'rendasua.ca.auth0.com');
    vi.stubEnv('EXPO_PUBLIC_AUTH0_CLIENT_ID', 'KkXPODOPy753EuBeaFttZk148wyMkvJ4');
    vi.stubEnv('EXPO_PUBLIC_AUTH0_AUDIENCE', 'https://rendasua.ca.auth0.com/api/v2/');

    const env = getEnv();

    expect(env.apiUrl).toBe('https://dev.api.rendasua.com/api');
    expect(env.hasuraUrl).toBe('https://hasura-dev.rendasua.com/v1/graphql');
    expect(env.auth0Config.domain).toBe('rendasua.ca.auth0.com');
    expect(env.auth0Config.clientId).toBe('KkXPODOPy753EuBeaFttZk148wyMkvJ4');
    expect(env.auth0Config.audience).toBe('https://rendasua.ca.auth0.com/api/v2/');
    expect(env.stripePublishableKey.startsWith('pk_live_')).toBe(true);
  });
});
