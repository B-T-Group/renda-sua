import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface UserProfile {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type_id: string;
  client?: {
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  };
  agent?: {
    id: string;
    user_id: string;
    vehicle_type_id: string;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
  };
  business?: {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface UserProfileResponse {
  success: boolean;
  user: UserProfile;
  message: string;
}

export type UserType = 'client' | 'agent' | 'business';

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  const apiClient = useApiClient();

  const checkProfile = async () => {
    if (!apiClient) {
      setError('API client not available');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<UserProfileResponse>('/users/me');

      if (response.data.success) {
        const userProfile = response.data.user;
        setProfile(userProfile);

        // Determine user type based on user_type_id
        const typeMap: Record<string, UserType> = {
          client: 'client',
          agent: 'agent',
          business: 'business',
        };

        const type = typeMap[userProfile.user_type_id];
        setUserType(type || null);

        // Check if profile is complete based on user type
        let complete = false;
        switch (type) {
          case 'client':
            complete = !!userProfile.client;
            break;
          case 'agent':
            complete = !!userProfile.agent;
            break;
          case 'business':
            complete = !!userProfile.business;
            break;
          default:
            complete = false;
        }

        setIsProfileComplete(complete);
      } else {
        setError(response.data.message || 'Failed to fetch user profile');
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Profile not found');
        setIsProfileComplete(false);
      } else {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to fetch user profile'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiClient) {
      checkProfile();
    }
  }, [apiClient]);

  return {
    profile,
    loading,
    error,
    userType,
    isProfileComplete,
    refetch: checkProfile,
  };
};
