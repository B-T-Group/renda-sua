// Environment configuration with validation
const getEnvironment = () => {
  const hasuraUrl =
    process.env.REACT_APP_HASURA_URL || 'http://localhost:8080/v1/graphql';
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
  const auth0Domain = process.env.REACT_APP_AUTH0_DOMAIN || '';
  const auth0ClientId = process.env.REACT_APP_AUTH0_CLIENT_ID || '';
  const auth0Audience = process.env.REACT_APP_AUTH0_AUDIENCE || '';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const enableDebugMode = process.env.REACT_APP_ENABLE_DEBUG_MODE === 'true';
  const enableAnalytics = process.env.REACT_APP_ENABLE_ANALYTICS === 'true';
  const defaultLocale = process.env.REACT_APP_DEFAULT_LOCALE || 'en';
  const supportedLocales = process.env.REACT_APP_SUPPORTED_LOCALES?.split(
    ','
  ) || ['en', 'fr'];
  const enableHotReload = process.env.REACT_APP_ENABLE_HOT_RELOAD === 'true';
  const enableSourceMaps = process.env.REACT_APP_ENABLE_SOURCE_MAPS === 'true';

  // Log environment for debugging
  if (enableDebugMode) {
    console.log('Environment Configuration:', {
      hasuraUrl,
      backendUrl,
      auth0Domain: auth0Domain ? 'SET' : 'NOT SET',
      auth0ClientId: auth0ClientId ? 'SET' : 'NOT SET',
      auth0Audience: auth0Audience ? 'SET' : 'NOT SET',
      isDevelopment,
      enableDebugMode,
      enableAnalytics,
      defaultLocale,
      supportedLocales,
      enableHotReload,
      enableSourceMaps,
      nodeEnv: process.env.NODE_ENV,
    });
  }

  return {
    hasuraUrl,
    backendUrl,
    auth0: {
      domain: auth0Domain,
      clientId: auth0ClientId,
      audience: auth0Audience,
    },
    isDevelopment,
    enableDebugMode,
    enableAnalytics,
    i18n: {
      defaultLocale,
      supportedLocales,
    },
    development: {
      enableHotReload,
      enableSourceMaps,
    },
  };
};

export const environment = getEnvironment();
