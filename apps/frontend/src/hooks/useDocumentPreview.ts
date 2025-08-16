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
  const { apiClient } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDocumentPreviewUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      if (!apiClient) {
        setError('API client not available');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
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
    [apiClient]
  );

  return {
    getDocumentPreviewUrl,
    loading,
    error,
  };
};
