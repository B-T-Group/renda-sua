// Production environment configuration
export const environment = {
  hasuraUrl:
    process.env.REACT_APP_HASURA_URL ||
    'https://your-production-hasura-url.com/v1/graphql',
  backendUrl:
    process.env.REACT_APP_BACKEND_URL ||
    'https://your-production-backend-url.com',
  auth0: {
    domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
    clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '',
    audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
  },
  isDevelopment: false,
  enableDebugMode: false,
  enableAnalytics: true,
  i18n: {
    defaultLocale: process.env.REACT_APP_DEFAULT_LOCALE || 'en',
    supportedLocales: process.env.REACT_APP_SUPPORTED_LOCALES?.split(',') || [
      'en',
      'fr',
    ],
  },
  development: {
    enableHotReload: false,
    enableSourceMaps: false,
  },
};
