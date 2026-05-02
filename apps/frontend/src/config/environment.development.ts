// Development environment configuration
const getDevelopmentEnvironment = () => {
  const hasuraUrl =
    process.env.REACT_APP_HASURA_URL ||
    'https://hasura-dev.rendasua.com/v1/graphql';
  const auth0Domain =
    process.env.REACT_APP_AUTH0_DOMAIN || 'rendasua.ca.auth0.com';
  const auth0ClientId =
    process.env.REACT_APP_AUTH0_CLIENT_ID || 'KkXPODOPy753EuBeaFttZk148wyMkvJ4';
  const auth0Audience =
    process.env.REACT_APP_AUTH0_AUDIENCE ||
    'https://rendasua.ca.auth0.com/api/v2/';

  return {
    hasuraUrl,
    auth0: {
      domain: auth0Domain,
      clientId: auth0ClientId,
      audience: auth0Audience,
    },
    isDevelopment: true,
    isProduction: false,
    isLocal: false,
    /** Local Nest default; override for hosted dev (e.g. REACT_APP_API_URL=https://dev.api.rendasua.com/api). */
    apiUrl:
      process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
    webAppOrigin:
      process.env.REACT_APP_WEB_APP_ORIGIN || 'http://localhost:4200',
    googleMapsBrowserApiKey:
      process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
      'AIzaSyDpI80RcSNpjLNybedvZ62QFyV4485tiyI',
    enableDebugLogging: true,
    enableAnalytics: false,
  };
};

export const environment = getDevelopmentEnvironment();
