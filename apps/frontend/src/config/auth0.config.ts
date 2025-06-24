export const auth0Config = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || 'your-domain.auth0.com',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || 'your-client-id',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: process.env.REACT_APP_AUTH0_AUDIENCE || 'https://your-api-identifier',
    scope: 'openid profile email'
  },
  cacheLocation: 'localstorage' as const,
  useRefreshTokens: true,
}; 