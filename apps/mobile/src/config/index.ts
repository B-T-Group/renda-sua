/**
 * Configuration de l'app agent – API, auth, env.
 * Alignée sur le frontend renda-sua (même API, même Auth0).
 * Les valeurs peuvent être surchargées via app.config (extra) ou variables d'env Expo.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const isDev = __DEV__;

export const config = {
  apiUrl:
    extra.apiUrl ||
    process.env.EXPO_PUBLIC_API_URL ||
    (isDev ? 'https://dev.api.rendasua.com/api' : 'https://prod.api.rendasua.com/api'),
  auth0: {
    domain: extra.auth0Domain || process.env.EXPO_PUBLIC_AUTH0_DOMAIN || 'rendasua.ca.auth0.com',
    clientId:
      extra.auth0ClientId || process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || 'KkXPODOPy753EuBeaFttZk148wyMkvJ4',
    audience:
      extra.auth0Audience ||
      process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ||
      'https://rendasua.ca.auth0.com/api/v2/',
  },
  isDevelopment: isDev,
  isProduction: !isDev,
  enableDebugLogging: isDev,
} as const;

export default config;
