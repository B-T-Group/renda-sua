export const apiConfig = {
  backend: {
    baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000',
  },
  hasura: {
    baseURL: process.env.REACT_APP_HASURA_URL || 'http://localhost:8080/v1/graphql',
  },
}; 