import { useAuth0 } from '@auth0/auth0-react';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useApiClient } from '../hooks/useApiClient';

export interface Address {
  id: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
  address_type: string;
  created_at: string;
  updated_at: string;
}

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
  addresses?: Address[];
  created_at: string;
  updated_at: string;
}

export interface UserProfileResponse {
  success: boolean;
  user: UserProfile;
  message: string;
}

export type UserType = 'client' | 'agent' | 'business';

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  userType: UserType | null;
  isProfileComplete: boolean;
  refetch: () => Promise<void>;
  clearProfile: () => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined
);

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({
  children,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  const { isAuthenticated } = useAuth0();
  const apiClient = useApiClient();

  const checkProfile = async () => {
    if (!apiClient || !isAuthenticated) {
      setError('API client not available or not authenticated');
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

  const clearProfile = () => {
    setProfile(null);
    setUserType(null);
    setIsProfileComplete(false);
    setError(null);
  };

  // Fetch profile when authenticated and API client is available
  useEffect(() => {
    if (isAuthenticated && apiClient) {
      checkProfile();
    } else if (!isAuthenticated) {
      clearProfile();
    }
  }, [isAuthenticated, apiClient]);

  const value: UserProfileContextType = {
    profile,
    loading,
    error,
    userType,
    isProfileComplete,
    refetch: checkProfile,
    clearProfile,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfileContext = (): UserProfileContextType => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error(
      'useUserProfileContext must be used within a UserProfileProvider'
    );
  }
  return context;
};
