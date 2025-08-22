import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { environment } from '../config/environment';

export const useGraphQLSubscription = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [client, setClient] = useState<ApolloClient<unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const setupClient = async () => {
      if (!isAuthenticated) {
        if (isMounted) {
          setClient(null);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Create HTTP link
        const httpLink = createHttpLink({
          uri: environment.hasuraUrl,
        });

        // Add authentication context
        const authLink = setContext(async (_, { headers }) => {
          try {
            const token = await getAccessTokenSilently();
            return {
              headers: {
                ...headers,
                authorization: token ? `Bearer ${token}` : '',
              },
            };
          } catch (error) {
            console.error('Failed to get token:', error);
            return {
              headers: {
                ...headers,
              },
            };
          }
        });

        // Create Apollo Client with HTTP link only for now
        const apolloClient = new ApolloClient({
          link: authLink.concat(httpLink),
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

        if (isMounted) {
          setClient(apolloClient);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to setup GraphQL client:', error);
        if (isMounted) {
          setClient(null);
          setIsLoading(false);
          setError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    };

    setupClient();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  return {
    client,
    isLoading,
    error,
  };
};

export default useGraphQLSubscription;
