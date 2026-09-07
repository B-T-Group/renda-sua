/**
 * Configuration Auth0 pour Rendasua Agent (mobile).
 * Resource Owner Password Grant (email + mot de passe), sans redirection navigateur.
 * Aligné sur le frontend renda-sua (même tenant Auth0).
 *
 * OTP téléphone : déclenché via l’API Nest `POST /auth/login/start-otp` (pas Auth0 direct).
 *
 * API locale : env runtime `local` (écran connexion) ou `EXPO_PUBLIC_API_URL` (voir `getEnv()`).
 */

import { getRuntimeEnv, type EnvName } from './envSwitch';

export interface Auth0Config {
  domain: string;
  clientId: string;
  redirectUri: string;
  /** Default audience (e.g. Auth0 Management API). Used when `resourceServerAudience` is not set. */
  audience: string;
  /**
   * If the Nest API validates a different JWT audience than `audience`, set it here.
   * Used for `audience` on ROPG `/oauth/token` requests.
   */
  resourceServerAudience?: string;
  /** Longueur OTP affichée (aligner sur le backend / SMS). */
  otpLength: number;
}

/** Audience sent when requesting access tokens (ROPG). */
export function getTokenRequestAudience(cfg: Auth0Config): string {
  return cfg.resourceServerAudience ?? cfg.audience;
}

export interface RendasuaEnv {
  apiUrl: string;
  hasuraUrl?: string;
  /** Fallback only — runtime prefers GET /stripe-payments/config from the API. */
  stripePublishableKey: string;
  auth0Config: Auth0Config;
}

const environments: { [key: string]: RendasuaEnv } = {
  dev: {
    apiUrl: 'https://dev.api.rendasua.com/api',
    hasuraUrl: 'https://hasura-dev.rendasua.com/v1/graphql',
    stripePublishableKey:
      'pk_test_51TmILnLBaKicCErK28cHNMBxBBgho2lxbim2RfW7x4Zy5iVD8e1J9a16CvLiSdKvtTjjdQYxC4dcsxmSxIqb8Jj0009QRBgqT2',
    auth0Config: {
      domain: 'rendasua.ca.auth0.com',
      clientId: 'KkXPODOPy753EuBeaFttZk148wyMkvJ4',
      redirectUri: 'exp://localhost:19000/--/',
      audience: 'https://rendasua.ca.auth0.com/api/v2/',
      otpLength: 4,
    },
  },
  prod: {
    apiUrl: 'https://prod.api.rendasua.com/api',
    hasuraUrl: 'https://hasura.rendasua.com/v1/graphql',
    stripePublishableKey:
      'pk_live_51TmILaPzvx7093BNE1Fcm3DVbvEtNiN2KDYEvo0QMy1mkzI9kd7sik1IKiWw6wkx7nNDlTWVQGn26AOWMIaAasiF00nJ93YNJG',
    auth0Config: {
      domain: 'rendasua-prod.ca.auth0.com',
      clientId: 'aIAEhMVPX6ENAdVU2gzZguYJYhlp2xCM',
      redirectUri: 'rendasua-agent://rendasua-prod.ca.auth0.com/callback',
      audience: 'https://rendasua-prod.ca.auth0.com/api/v2/',
      otpLength: 4,
    },
  },
  local: {
    apiUrl: 'http://localhost:3000/api',
    hasuraUrl: 'http://localhost:8080/v1/graphql',
    stripePublishableKey:
      'pk_test_51TmILnLBaKicCErK28cHNMBxBBgho2lxbim2RfW7x4Zy5iVD8e1J9a16CvLiSdKvtTjjdQYxC4dcsxmSxIqb8Jj0009QRBgqT2',
    auth0Config: {
      domain: 'rendasua.ca.auth0.com',
      clientId: 'KkXPODOPy753EuBeaFttZk148wyMkvJ4',
      redirectUri: 'exp://localhost:19000/--/',
      audience: 'https://rendasua.ca.auth0.com/api/v2/',
      otpLength: 4,
    },
  },
};

/** Normalise `EXPO_PUBLIC_API_URL` (ex. `http://localhost:3000` → `.../api`). */
function normalizeApiUrlOverride(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '');
  if (!u.endsWith('/api')) {
    u = `${u}/api`;
  }
  return u;
}

/**
 * Surcharges build-time (Expo) : même Auth0 que l’env choisi, API (et optionnellement Hasura) ailleurs.
 * Redémarrer le bundler après modification des variables.
 */
function mergeExpoPublicOverrides(base: RendasuaEnv): RendasuaEnv {
  const apiRaw = process.env.EXPO_PUBLIC_API_URL?.trim();
  const hasuraRaw = process.env.EXPO_PUBLIC_HASURA_URL?.trim();
  if (!apiRaw && !hasuraRaw) return base;
  return {
    ...base,
    ...(apiRaw ? { apiUrl: normalizeApiUrlOverride(apiRaw) } : {}),
    ...(hasuraRaw ? { hasuraUrl: hasuraRaw.replace(/\/+$/, '') } : {}),
  };
}

/**
 * Détermine l’environnement (dev / prod / local).
 * Par défaut : prod. Dev/local uniquement si choix persisté (Developer Options) ou MANUAL_ENV.
 */
function getEnvName(): string {
  const runtime = getRuntimeEnv();
  if (runtime) return runtime;
  return 'prod';
}

export function getEnv(): RendasuaEnv {
  const env = getEnvName();
  const base = environments[env] ?? environments.prod;
  return mergeExpoPublicOverrides(base);
}

/** API base URL for a given env (preview before switching). */
export function getApiUrlForEnv(name: EnvName): string {
  const base = environments[name] ?? environments.prod;
  return mergeExpoPublicOverrides(base).apiUrl;
}

/** Hasura GraphQL endpoint for the active environment (read on each request). */
export function getHasuraGraphqlUri(): string {
  const active = getEnv();
  if (active.hasuraUrl?.trim()) {
    return active.hasuraUrl.trim();
  }
  const name = getEnvName();
  const fallback = environments[name]?.hasuraUrl ?? environments.prod.hasuraUrl;
  return fallback ?? 'https://hasura.rendasua.com/v1/graphql';
}

/** @deprecated Prefer `getEnv()` — snapshot at module load, ignores runtime env switch. */
export const env = getEnv();
