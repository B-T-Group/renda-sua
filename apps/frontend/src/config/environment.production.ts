// Production environment configuration
const getProductionEnvironment = () => {
  const hasuraUrl =
    process.env.HASURA_GRAPHQL_ENDPOINT ||
    'https://rendasua-prod.hasura.app/v1/graphql';
  const auth0Domain =
    process.env.REACT_APP_AUTH0_DOMAIN || 'rendasua-prod.ca.auth0.com';
  const auth0ClientId =
    process.env.REACT_APP_AUTH0_CLIENT_ID || 'aIAEhMVPX6ENAdVU2gzZguYJYhlp2xCM';
  const auth0Audience =
    process.env.REACT_APP_AUTH0_AUDIENCE ||
    'https://rendasua-prod.ca.auth0.com/api/v2/';

  return {
    hasuraUrl,
    auth0: {
      domain: auth0Domain,
      clientId: auth0ClientId,
      audience: auth0Audience,
    },
    isDevelopment: false,
    isProduction: true,
    isLocal: false,
    apiUrl: 'https://prod.rendasua.com',
    enableDebugLogging: false,
    enableAnalytics: true,
  };
};

export const environment = getProductionEnvironment();
