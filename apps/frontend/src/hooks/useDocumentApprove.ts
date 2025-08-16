import { useCallback, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useApiClient } from './useApiClient';

export interface ApproveUploadResponse {
  success: boolean;
  message: string;
}

export const useDocumentApprove = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      if (isLoading) {
        setError('Authentication is still loading');
        return false;
      }

      if (!isAuthenticated) {
        setError('User not authenticated');
        return false;
      }

      if (!apiClient) {
        setError('API client not available - please try refreshing the page');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        console.log('Approving document:', documentId);
        console.log('API client base URL:', apiClient.defaults.baseURL);

        const response = await apiClient.patch<ApproveUploadResponse>(
          `/uploads/${documentId}/approve`
        );

        if (response.data.success) {
          return true;
        } else {
          setError('Failed to approve document');
          return false;
        }
      } catch (err: any) {
        console.error('Error approving document:', err);
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to approve document';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, isAuthenticated, isLoading]
  );

  return {
    approveDocument,
    loading,
    error,
  };
};
