import { useCallback, useState } from 'react';
import { agentApi } from '../services/agentApi';

export function useDeleteAccount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await agentApi.users.deleteMyAccount();
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to delete account'
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { deleteAccount, loading, error, clearError };
}
