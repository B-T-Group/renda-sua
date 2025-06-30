// Production environment configuration
const getProductionEnvironment = () => {
  const hasuraUrl =
    process.env.HASURA_GRAPHQL_ENDPOINT ||
    'https://api.rendasua.com/v1/graphql';
  const auth0Domain = process.env.REACT_APP_AUTH0_DOMAIN || '';
  const auth0ClientId = process.env.REACT_APP_AUTH0_CLIENT_ID || '';
  const auth0Audience = process.env.REACT_APP_AUTH0_AUDIENCE || '';

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
    apiUrl: process.env.REACT_APP_API_URL || 'https://api.rendasua.com',
    enableDebugLogging: false,
    enableAnalytics: true,
  };
};

export const environment = getProductionEnvironment();
