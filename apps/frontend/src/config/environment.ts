// Environment configuration with validation
const getEnvironment = () => {
  const hasuraUrl =
    process.env.REACT_APP_HASURA_URL || 'http://localhost:8080/v1/graphql';
  const auth0Domain =
    process.env.REACT_APP_AUTH0_DOMAIN || 'groupe-bt-client-dev.us.auth0.com';
  const auth0ClientId =
    process.env.REACT_APP_AUTH0_CLIENT_ID || '8O0pK4ySmqP3rBW53K15I3yFsgx5v7Mw';
  const auth0Audience =
    process.env.REACT_APP_AUTH0_AUDIENCE ||
    'https://groupe-bt-client-dev.us.auth0.com/api/v2/';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log environment for debugging
  console.log('Environment Configuration:', {
    hasuraUrl,
    auth0Domain: auth0Domain ? 'SET' : 'NOT SET',
    auth0ClientId: auth0ClientId ? 'SET' : 'NOT SET',
    auth0Audience: auth0Audience ? 'SET' : 'NOT SET',
    isDevelopment,
    nodeEnv: process.env.NODE_ENV,
  });

  return {
    hasuraUrl,
    auth0: {
      domain: auth0Domain,
      clientId: auth0ClientId,
      audience: auth0Audience,
    },
    isDevelopment,
    isProduction: process.env.NODE_ENV === 'production',
    isLocal:
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'development',
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
    enableDebugLogging: isDevelopment,
    enableAnalytics: process.env.NODE_ENV === 'production',
  };
};

export const environment = getEnvironment();
