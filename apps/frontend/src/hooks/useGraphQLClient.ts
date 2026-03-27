import { GraphQLClient } from 'graphql-request';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { environment } from '../config/environment';
import { useSessionAuth } from '../contexts/SessionAuthContext';

export const useGraphQLClient = () => {
  const { getAccessToken, isAuthenticated, logout } = useSessionAuth();
  const [client, setClient] = useState<GraphQLClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const token = await getAccessToken();
        if (!token) throw new Error('No access token available');

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
  }, [getAccessToken, isAuthenticated]);

  // Memoize the getAuthenticatedClient function to prevent unnecessary re-renders
  const getAuthenticatedClient =
    useCallback(async (): Promise<GraphQLClient | null> => {
      if (!isAuthenticated) return null;

      try {
        const token = await getAccessToken();
        if (!token) return null;
        return new GraphQLClient(environment.hasuraUrl, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Error getting authenticated client:', error);
        await logout();
        return null;
      }
    }, [isAuthenticated, getAccessToken, logout]);

  return {
    client,
    isLoading,
    error,
    getAuthenticatedClient,
    baseClient,
  };
};

export default useGraphQLClient;
