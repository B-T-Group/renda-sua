import { useApiClient } from './useApiClient';
import { useGraphQLClient } from './useGraphQLClient';

export const useClients = () => {
  const apiClient = useApiClient();
  const graphQLClient = useGraphQLClient();

  return {
    apiClient,
    graphQLClient,
  };
}; 