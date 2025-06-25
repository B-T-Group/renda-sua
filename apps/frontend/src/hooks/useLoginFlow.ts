import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from './useApiClient';

export const useLoginFlow = () => {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  useEffect(() => {
    const checkUserProfile = async () => {
      if (!isAuthenticated || !user) return;
      
      // Wait for apiClient to be available
      if (!apiClient) {
        return;
      }

      setIsCheckingProfile(true);
      
      try {
        // Try to get user profile from backend
        await apiClient.get('/users/me');
        
        // If successful, user has a complete profile, redirect to dashboard
        navigate('/dashboard');
      } catch (error: any) {
        if (error.response?.status === 404) {
          // User doesn't have a complete profile, redirect to complete profile page
          navigate('/complete-profile');
        } else {
          // Other error, redirect to dashboard as fallback
          console.error('Error checking user profile:', error);
          navigate('/dashboard');
        }
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, [isAuthenticated, user, apiClient, navigate]);

  return {
    isCheckingProfile,
    isAuthenticated,
    isLoading,
    user,
  };
}; 