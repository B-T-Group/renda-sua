export const environment = {
  production: true,
  port: process.env.PORT || 3000,
  hasura: {
    adminSecret: process.env.HASURA_ADMIN_SECRET,
    endpoint: process.env.HASURA_ENDPOINT
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE
  }
}; 