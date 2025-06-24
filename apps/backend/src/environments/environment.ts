export const environment = {
  production: false,
  port: 3000,
  hasura: {
    adminSecret: process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey',
    endpoint: process.env.HASURA_ENDPOINT || 'http://localhost:8080/v1/graphql'
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN || 'your-domain.auth0.com',
    audience: process.env.AUTH0_AUDIENCE || 'your-api-audience'
  }
}; 