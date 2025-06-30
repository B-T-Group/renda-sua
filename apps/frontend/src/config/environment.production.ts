// Production environment configuration
export const environment = {
  hasuraUrl: 'https://your-production-hasura-url.com/v1/graphql',
  backendUrl: 'https://your-production-backend-url.com',
  auth0: {
    domain: '',
    clientId: '',
    audience: '',
  },
  isDevelopment: false,
  enableDebugMode: false,
  enableAnalytics: true,
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fr'],
  },
  development: {
    enableHotReload: false,
    enableSourceMaps: false,
  },
};
