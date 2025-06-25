import { useApiClient } from './useApiClient';
import { useHasuraClient } from './useHasuraClient';

export const useClients = () => {
  const apiClient = useApiClient();
  const hasuraClient = useHasuraClient();

  return {
    apiClient,
    hasuraClient,
  };
}; 