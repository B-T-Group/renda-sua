import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
  split,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { useAuth0 } from '@auth0/auth0-react';
import { createClient } from 'graphql-ws';
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

        // Create HTTP link for queries and mutations
        const httpLink = createHttpLink({
          uri: environment.hasuraUrl,
        });

        // Add authentication context for HTTP requests
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

        // Create WebSocket link for subscriptions
        let wsLink = null;
        try {
          const wsUrl = environment.hasuraUrl
            .replace(/^http:\/\//, 'ws://')
            .replace(/^https:\/\//, 'wss://');

          console.log('Creating WebSocket connection to:', wsUrl);

          const wsClient = createClient({
            url: wsUrl,
            connectionParams: async () => {
              try {
                const token = await getAccessTokenSilently();
                return {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                };
              } catch (error) {
                console.error('Failed to get token for WebSocket:', error);
                return {};
              }
            },
            retryAttempts: 3,
            retryWait: (retryCount) =>
              new Promise((resolve) =>
                setTimeout(resolve, Math.min(1000 * 2 ** retryCount, 10000))
              ),
            shouldRetry: (errOrCloseEvent) => {
              console.log('WebSocket retry condition:', errOrCloseEvent);
              return true;
            },
          });

          wsLink = new GraphQLWsLink(wsClient);
          console.log('WebSocket link created successfully');
        } catch (wsError) {
          console.warn('WebSocket link creation failed:', wsError);
        }

        // Create the final link - split between WebSocket and HTTP
        const link = wsLink
          ? split(
              ({ query }) => {
                const definition = getMainDefinition(query);
                return (
                  definition.kind === 'OperationDefinition' &&
                  definition.operation === 'subscription'
                );
              },
              wsLink,
              from([authLink, httpLink])
            )
          : from([authLink, httpLink]);

        // Create Apollo Client
        const apolloClient = new ApolloClient({
          link,
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
