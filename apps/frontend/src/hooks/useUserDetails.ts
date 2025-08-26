import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

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
  const { client } = useGraphQLClient();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetails = useCallback(async () => {
    if (!client || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const query = `
        query GetUserDetails($userId: uuid!) {
          users_by_pk(id: $userId) {
            id
            first_name
            last_name
            email
            user_type_id
            client {
              id
            }
            agent {
              id
            }
            business {
              id
              name
              is_admin
            }
          }
        }
      `;

      const response = await client.request(query, { userId });
      const userData = response.users_by_pk;

      if (userData) {
        setUser(userData);
      } else {
        setError('User not found');
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
      setError('Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  }, [client, userId]);

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
