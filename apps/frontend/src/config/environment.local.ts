// Local environment configuration
export const environment = {
  hasuraUrl: 'http://localhost:8080/v1/graphql',
  backendUrl: 'http://localhost:3000',
  auth0: {
    domain: 'groupe-bt-client-dev.us.auth0.com',
    clientId: '8O0pK4ySmqP3rBW53K15I3yFsgx5v7Mw',
    audience: 'https://groupe-bt-client-dev.us.auth0.com/api/v2/',
  },
  isDevelopment: true,
  enableDebugMode: true,
  enableAnalytics: false,
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fr'],
  },
  development: {
    enableHotReload: true,
    enableSourceMaps: true,
  },
};
