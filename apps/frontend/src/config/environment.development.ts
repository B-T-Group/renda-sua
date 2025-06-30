// Development environment configuration
export const environment = {
  hasuraUrl: 'https://healthy-mackerel-72.hasura.app/v1/graphql',
  backendUrl:
    'https://rendasua-service.m2naz4zc6z54g.ca-central-1.cs.amazonlightsail.com',
  auth0: {
    domain:
      process.env.REACT_APP_AUTH0_DOMAIN || 'groupe-bt-client-dev.us.auth0.com',
    clientId:
      process.env.REACT_APP_AUTH0_CLIENT_ID ||
      '8O0pK4ySmqP3rBW53K15I3yFsgx5v7Mw',
    audience:
      process.env.REACT_APP_AUTH0_AUDIENCE ||
      'https://groupe-bt-client-dev.us.auth0.com/api/v2/',
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
