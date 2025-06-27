export const auth0Config = {
  domain:
    process.env.REACT_APP_AUTH0_DOMAIN || 'groupe-bt-client-dev.us.auth0.com',
  clientId:
    process.env.REACT_APP_AUTH0_CLIENT_ID || '8O0pK4ySmqP3rBW53K15I3yFsgx5v7Mw',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience:
      process.env.REACT_APP_AUTH0_AUDIENCE ||
      'https://groupe-bt-client-dev.us.auth0.com/api/v2/',
    scope: 'openid profile email',
  },
  cacheLocation: 'localstorage' as const,
  useRefreshTokens: true,
  skipRedirectCallback: window.location.pathname === '/loading-demo',
  // Performance optimizations
  advancedOptions: {
    defaultScope: 'openid profile email'
  }
}; 