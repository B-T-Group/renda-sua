// Environment configuration with validation
const getEnvironment = () => {
  const hasuraUrl =
    process.env.REACT_APP_HASURA_URL ||
    'https://healthy-mackerel-72.hasura.app/v1/graphql';
  const auth0Domain =
    process.env.REACT_APP_AUTH0_DOMAIN || 'groupe-bt-client-dev.us.auth0.com';
  const auth0ClientId =
    process.env.REACT_APP_AUTH0_CLIENT_ID || '8O0pK4ySmqP3rBW53K15I3yFsgx5v7Mw';
  const auth0Audience =
    process.env.REACT_APP_AUTH0_AUDIENCE ||
    'https://groupe-bt-client-dev.us.auth0.com/api/v2/';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    hasuraUrl,
    auth0: {
      domain: auth0Domain,
      clientId: auth0ClientId,
      audience: auth0Audience,
    },
    isDevelopment,
  };
};

export const environment = getEnvironment();
