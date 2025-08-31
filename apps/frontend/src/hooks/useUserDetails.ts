import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

interface UserDetails {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_type_id: string;
  client?: { id: string };
  agent?: { id: string };
  business?: { id: string; name: string; is_admin: boolean };
}

interface UseUserDetailsResult {
  user: UserDetails | null;
  loading: boolean;
  error: string | null;
  userName: string;
}

export const useUserDetails = (userId: string): UseUserDetailsResult => {
  const apiClient = useApiClient();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetails = useCallback(async () => {
    if (!apiClient || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/admin/users/${userId}`);

      if (response.data.success) {
        setUser(response.data.user);
      } else {
        setError(response.data.error || 'User not found');
      }
    } catch (err: any) {
      console.error('Error fetching user details:', err);
      setError(
        err.response?.data?.error ||
          err.message ||
          'Failed to fetch user details'
      );
    } finally {
      setLoading(false);
    }
  }, [apiClient, userId]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  const userName = user
    ? user.user_type_id === 'business' && user.business?.name
      ? user.business.name
      : `${user.first_name} ${user.last_name}`.trim() || user.email
    : '';

  return {
    user,
    loading,
    error,
    userName,
  };
};
