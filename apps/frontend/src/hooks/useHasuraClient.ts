import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

export const useHasuraClient = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [client, setClient] = useState<ApolloClient<any> | null>(null);

  useEffect(() => {
    const setupClient = async () => {
      if (!isAuthenticated) {
        setClient(null);
        return;
      }

      try {
        const token = await getAccessTokenSilently();
        
        // Create HTTP link
        const httpLink = createHttpLink({
          uri: process.env.REACT_APP_HASURA_URL || 'http://localhost:8080/v1/graphql',
        });

        // Create auth link to add Authorization header
        const authLink = setContext(async (_, { headers }) => {
          return {
            headers: {
              ...headers,
              'Authorization': `Bearer ${token}`,
            }
          };
        });

        // Create Apollo Client
        const apolloClient = new ApolloClient({
          link: from([authLink, httpLink]),
          cache: new InMemoryCache(),
          defaultOptions: {
            watchQuery: {
              errorPolicy: 'all',
            },
            query: {
              errorPolicy: 'all',
            },
          },
        });

        setClient(apolloClient);
      } catch (error) {
        console.error('Failed to setup Hasura client:', error);
        setClient(null);
      }
    };

    setupClient();
  }, [getAccessTokenSilently, isAuthenticated]);

  return client;
}; 