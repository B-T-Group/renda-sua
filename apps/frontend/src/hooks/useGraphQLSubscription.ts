import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  split,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { useAuth0 } from '@auth0/auth0-react';
import { createClient } from 'graphql-ws';
import { useCallback, useEffect, useState } from 'react';
import { environment } from '../config/environment';

export const useGraphQLSubscription = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [client, setClient] = useState<ApolloClient<unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create WebSocket link for subscriptions
  const createWsLink = useCallback(async () => {
    try {
      // Ensure we have a valid URL
      if (!environment.hasuraUrl) {
        console.error('Hasura URL is not configured');
        return null;
      }

      const wsUrl = environment.hasuraUrl
        .replace(/^http:\/\//, 'ws://')
        .replace(/^https:\/\//, 'wss://');

      console.log('Creating WebSocket connection to:', wsUrl);

      const token = await getAccessTokenSilently();

      const wsClient = createClient({
        url: wsUrl,
        connectionParams: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

      return new GraphQLWsLink(wsClient);
    } catch (error) {
      console.error('Failed to create WebSocket link:', error);
      return null;
    }
  }, [getAccessTokenSilently]);

  // Create HTTP link for queries and mutations
  const createHttpLinkWithAuth = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      return createHttpLink({
        uri: environment.hasuraUrl,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Failed to create HTTP link:', error);
      return createHttpLink({
        uri: environment.hasuraUrl,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }, [getAccessTokenSilently]);

  // Create Apollo Client
  const createApolloClient = useCallback(async () => {
    try {
      console.log('Creating Apollo Client...');

      // Always create HTTP link first
      const httpLink = await createHttpLinkWithAuth();

      // Try to create WebSocket link, but don't fail if it doesn't work
      let wsLink = null;
      try {
        wsLink = await createWsLink();
        if (wsLink) {
          console.log('WebSocket link created successfully');
        }
      } catch (wsError) {
        console.warn(
          'WebSocket link creation failed, will use HTTP-only client:',
          wsError
        );
      }

      if (!wsLink) {
        console.log('Using HTTP-only client (no WebSocket support)');
        // Use HTTP-only client if WebSocket fails
        return new ApolloClient({
          link: httpLink,
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
      }

      console.log('Creating split link with WebSocket and HTTP');
      // Split links based on operation type
      const splitLink = split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        httpLink
      );

      return new ApolloClient({
        link: splitLink,
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
    } catch (error) {
      console.error('Failed to create Apollo Client:', error);

      // Last resort: create a basic HTTP-only client
      try {
        console.log('Creating fallback HTTP-only client');
        const fallbackHttpLink = createHttpLink({
          uri: environment.hasuraUrl,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        return new ApolloClient({
          link: fallbackHttpLink,
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
      } catch (fallbackError) {
        console.error('Failed to create fallback client:', fallbackError);
        throw error;
      }
    }
  }, [createWsLink, createHttpLinkWithAuth]);

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

        const apolloClient = await createApolloClient();

        if (isMounted) {
          setClient(apolloClient);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to setup GraphQL subscription client:', error);
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
  }, [isAuthenticated, createApolloClient]);

  return {
    client,
    isLoading,
    error,
  };
};

export default useGraphQLSubscription;
