import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface DocumentPreviewResponse {
  success: boolean;
  upload_record: {
    id: string;
    file_name: string;
    content_type: string;
    file_size: number;
    note?: string;
    is_approved: boolean;
    created_at: string;
  };
  presigned_url: string;
  expires_at: string;
}

export const useDocumentPreview = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDocumentPreviewUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      if (isLoading) {
        setError('Authentication is still loading');
        return null;
      }

      if (!isAuthenticated) {
        setError('User not authenticated');
        return null;
      }

      if (!apiClient) {
        setError('API client not available - please try refreshing the page');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        console.log(
          'Making API request to:',
          `/users/upload/${documentId}/view`
        );
        console.log('API client base URL:', apiClient.defaults.baseURL);

        const response = await apiClient.get<DocumentPreviewResponse>(
          `/users/upload/${documentId}/view`
        );

        if (response.data.success) {
          return response.data.presigned_url;
        } else {
          setError('Failed to get document preview URL');
          return null;
        }
      } catch (err: any) {
        console.error('Error getting document preview URL:', err);
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to get document preview URL';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, isAuthenticated, isLoading]
  );

  return {
    getDocumentPreviewUrl,
    loading,
    error,
  };
};
