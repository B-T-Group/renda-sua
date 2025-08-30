import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface UserUpload {
  id: string;
  user_id: string;
  file_name: string;
  key: string;
  content_type: string;
  file_size: number;
  document_type_id: number;
  is_approved: boolean;
  note?: string;
  created_at: string;
  updated_at: string;
  document_type: {
    id: number;
    name: string;
    description: string;
  };
  user: {
    id: string;
    identifier: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface AdminUserUploadsResponse {
  success: boolean;
  uploads: UserUpload[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: string;
}

export const useAdminUserUploads = (userId: string) => {
  const [uploads, setUploads] = useState<UserUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const apiClient = useApiClient();

  const fetchUploads = useCallback(
    async (page = 1, limit = 10) => {
      if (!apiClient || !userId) {
        setError('API client not available or user ID missing');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<AdminUserUploadsResponse>(
          `/admin/users/${userId}/uploads`,
          {
            params: { page, limit },
          }
        );

        if (response.data.success) {
          setUploads(response.data.uploads);
          setPagination(response.data.pagination);
        } else {
          setError(response.data.error || 'Failed to fetch uploads');
          setUploads([]);
        }
      } catch (err: any) {
        console.error('Error fetching user uploads:', err);
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to fetch user uploads'
        );
        setUploads([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient, userId]
  );

  useEffect(() => {
    if (userId) {
      fetchUploads();
    }
  }, [fetchUploads]);

  const refetch = useCallback(() => {
    return fetchUploads(pagination.page, pagination.limit);
  }, [fetchUploads, pagination.page, pagination.limit]);

  const loadPage = useCallback(
    (page: number) => {
      return fetchUploads(page, pagination.limit);
    },
    [fetchUploads, pagination.limit]
  );

  return {
    uploads,
    loading,
    error,
    pagination,
    refetch,
    loadPage,
  };
};
