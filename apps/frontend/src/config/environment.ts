// Environment configuration with validation
const getEnvironment = () => {
  const hasuraUrl =
    process.env.REACT_APP_HASURA_URL || 'http://localhost:8080/v1/graphql';
  const hasuraAdminSecret =
    process.env.REACT_APP_HASURA_ADMIN_SECRET || 'myadminsecretkey';
  const auth0Domain =
    process.env.REACT_APP_AUTH0_DOMAIN || 'rendasua.ca.auth0.com';
  const auth0ClientId =
    process.env.REACT_APP_AUTH0_CLIENT_ID || 'KkXPODOPy753EuBeaFttZk148wyMkvJ4';
  const auth0Audience =
    process.env.REACT_APP_AUTH0_AUDIENCE ||
    'https://rendasua.ca.auth0.com/api/v2/';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log environment for debugging
  console.log('Environment Configuration:', {
    hasuraUrl,
    hasuraAdminSecret: hasuraAdminSecret ? 'SET' : 'NOT SET',
    auth0Domain: auth0Domain ? 'SET' : 'NOT SET',
    auth0ClientId: auth0ClientId ? 'SET' : 'NOT SET',
    auth0Audience: auth0Audience ? 'SET' : 'NOT SET',
    isDevelopment,
    nodeEnv: process.env.NODE_ENV,
  });

  return {
    hasuraUrl,
    hasuraAdminSecret,
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
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
    enableDebugLogging: isDevelopment,
    enableAnalytics: process.env.NODE_ENV === 'production',
  };
};

export const environment = getEnvironment();
