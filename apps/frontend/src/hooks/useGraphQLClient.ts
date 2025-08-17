import { useAuth0 } from '@auth0/auth0-react';
import { GraphQLClient } from 'graphql-request';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { environment } from '../config/environment';
import { useTokenRefresh } from '../contexts/TokenRefreshContext';

export const useGraphQLClient = () => {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } =
    useAuth0();
  const [client, setClient] = useState<GraphQLClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safely get token refresh context
  let tokenRefreshContext;
  try {
    tokenRefreshContext = useTokenRefresh();
  } catch (error) {
    // Token refresh context not available yet, continue without it
    tokenRefreshContext = null;
  }

  const { getValidToken, refreshToken } = tokenRefreshContext || {};

  // Memoize the base client to prevent recreation
  const baseClient = useMemo(() => {
    return new GraphQLClient(environment.hasuraUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hasura-Role': 'anonymous',
      },
    });
  }, []);

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

        // Test token retrieval first
        const token = await getAccessTokenSilently();

        if (!isMounted) return;

        // Create authenticated client
        const authenticatedClient = new GraphQLClient(environment.hasuraUrl, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (isMounted) {
          setClient(authenticatedClient);
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
  }, [getAccessTokenSilently, isAuthenticated]);

  // Memoize the getAuthenticatedClient function to prevent unnecessary re-renders
  const getAuthenticatedClient =
    useCallback(async (): Promise<GraphQLClient | null> => {
      if (!isAuthenticated) return null;

      try {
        const token = await getAccessTokenSilently();
        return new GraphQLClient(environment.hasuraUrl, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Error getting authenticated client:', error);
        // Try to refresh token
        try {
          await getAccessTokenSilently({ cacheMode: 'off' });
          const newToken = await getAccessTokenSilently();
          return new GraphQLClient(environment.hasuraUrl, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${newToken}`,
            },
          });
        } catch (refreshError) {
          console.error(
            'Token refresh failed, redirecting to login:',
            refreshError
          );
          await loginWithRedirect();
          return null;
        }
      }
    }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

  return {
    client,
    isLoading,
    error,
    getAuthenticatedClient,
    baseClient,
  };
};

export default useGraphQLClient;
