import { useState, useCallback, useMemo } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

export interface UseGraphQLRequestOptions {
  skip?: boolean;
}

export const useGraphQLRequest = <TData = any, TVariables = any>(
  query: string,
  options: UseGraphQLRequestOptions = {}
) => {
  const { getAuthenticatedClient, isLoading: clientLoading, error: clientError } = useGraphQLClient();
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the query to prevent unnecessary re-renders
  const memoizedQuery = useMemo(() => query, [query]);
  const memoizedSkip = useMemo(() => options.skip, [options.skip]);

  const execute = useCallback(async (variables?: TVariables) => {
    if (memoizedSkip) return null;

    try {
      setLoading(true);
      setError(null);

      // Get a fresh authenticated client
      const authenticatedClient = await getAuthenticatedClient();
      if (!authenticatedClient) {
        throw new Error('No authenticated client available');
      }

      const result = await authenticatedClient.request<TData>(memoizedQuery, variables as object);
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('GraphQL request error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [memoizedQuery, memoizedSkip, getAuthenticatedClient]);

  const refetch = useCallback((variables?: TVariables) => {
    return execute(variables);
  }, [execute]);

  return {
    data,
    loading: loading || clientLoading,
    error: error || clientError,
    execute,
    refetch,
  };
}; 