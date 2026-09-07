import edgeToEdge from 'react-native-edge-to-edge/expo';

/**
 * Config Expo – utilisé au build / au démarrage.
 * MANUAL_ENV : forcer l’env ici (null = prod par défaut, comme getEnv() dans auth0.ts). À garder en sync avec src/config/envSwitch.ts.
 * Les variables EXPO_PUBLIC_* surchargent l’URL API / Hasura au-dessus de l’env choisi
 * (voir `getEnv()` dans src/config/auth0.ts). Redémarrer Expo après changement.
 */
const MANUAL_ENV: 'dev' | 'prod' | 'local' | null = null;

const defaultsByEnv = {
  prod: {
    apiUrl: 'https://prod.api.rendasua.com/api',
    auth0Domain: 'rendasua-prod.ca.auth0.com',
    auth0ClientId: 'aIAEhMVPX6ENAdVU2gzZguYJYhlp2xCM',
    auth0Audience: 'https://rendasua-prod.ca.auth0.com/api/v2/',
    /** Public web origin for `/items/:id/seo` share links (override with EXPO_PUBLIC_WEB_APP_ORIGIN). */
    webAppOrigin: 'https://rendasua.com',
  },
  dev: {
    apiUrl: 'https://dev.api.rendasua.com/api',
    auth0Domain: 'rendasua.ca.auth0.com',
    auth0ClientId: 'KkXPODOPy753EuBeaFttZk148wyMkvJ4',
    auth0Audience: 'https://rendasua.ca.auth0.com/api/v2/',
    webAppOrigin: '',
  },
  local: {
    apiUrl: 'http://localhost:3000/api',
    auth0Domain: 'rendasua.ca.auth0.com',
    auth0ClientId: 'KkXPODOPy753EuBeaFttZk148wyMkvJ4',
    auth0Audience: 'https://rendasua.ca.auth0.com/api/v2/',
    webAppOrigin: '',
  },
};

const envKey = MANUAL_ENV ?? 'prod';
const defaults = defaultsByEnv[envKey] ?? defaultsByEnv.prod;

export default ({ config }: { config: Record<string, unknown> }) => {
  const baseExtra = (config.extra as Record<string, unknown>) || {};
  const baseAndroid = (config.android as Record<string, unknown> | undefined) ?? {};
  return {
    ...config,
    android: {
      ...baseAndroid,
      googleServicesFile: './google-services.json',
    },
    plugins: [
      edgeToEdge({
        android: {
          parentTheme: 'Material2',
          enforceNavigationBarContrast: false,
        },
      }),
      [
        'expo-image-picker',
        {
          photosPermission:
            'Rendasua uses your photo library so you can choose pictures to upload—for example, a profile photo or verification documents (such as an ID) for your client or agent account, and product images for your business catalog.',
          cameraPermission:
            'Rendasua uses your camera so you can take photos to upload—for example, a profile photo, verification documents, or product images for your business.',
          microphonePermission: false,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Rendasua Agent uses your location to share your position with customers during deliveries.',
          locationAlwaysAndWhenInUsePermission:
            'Rendasua Agent updates your position in the background while you deliver so customers can follow progress.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      'expo-local-authentication',
      [
        'expo-secure-store',
        {
          faceIDPermission:
            'Rendasua uses Face ID to unlock your saved accounts on this device.',
        },
      ],
      'expo-localization',
      'expo-web-browser',
      ['expo-notifications', { defaultChannel: 'default' }],
      [
        '@stripe/stripe-react-native',
        {
          // Google Pay / Apple Pay disabled for now (card only).
          // Omit `merchantIdentifier`: setting it injects the Apple Pay
          // (com.apple.developer.in-app-payments) entitlement, which fails the
          // build unless the provisioning profile includes Apple Pay.
          enableGooglePay: false,
        },
      ],
      './plugins/withFirebaseAndroidInit.js',
    ],
    extra: {
      ...baseExtra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? defaults.apiUrl,
      auth0Domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? defaults.auth0Domain,
      auth0ClientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? defaults.auth0ClientId,
      auth0Audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? defaults.auth0Audience,
      webAppOrigin: process.env.EXPO_PUBLIC_WEB_APP_ORIGIN ?? defaults.webAppOrigin,
    },
  };
};
