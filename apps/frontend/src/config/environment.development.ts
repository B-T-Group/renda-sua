// Development environment configuration
const getDevelopmentEnvironment = () => {
  const hasuraUrl = 'https://healthy-mackerel-72.hasura.app/v1/graphql';
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
    apiUrl:
      'https://rendasua-service.m2naz4zc6z54g.ca-central-1.cs.amazonlightsail.com/api',
    enableDebugLogging: true,
    enableAnalytics: false,
  };
};

export const environment = getDevelopmentEnvironment();
