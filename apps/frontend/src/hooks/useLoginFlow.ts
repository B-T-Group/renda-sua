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
      
      // Wait for apiClient to be available with timeout
      if (!apiClient) {
        // Add a small delay to allow apiClient to initialize
        const timeout = setTimeout(() => {
          if (!apiClient) {
            console.warn('API client not available after timeout, redirecting to dashboard');
            navigate('/dashboard');
          }
        }, 2000); // 2 second timeout
        
        return () => clearTimeout(timeout);
      }

      setIsCheckingProfile(true);
      
      try {
        // Add timeout to the API call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        // Try to get user profile from backend
        await apiClient.get('/users/me', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        // If successful, user has a complete profile, redirect to dashboard
        navigate('/dashboard');
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn('Profile check timed out, redirecting to dashboard');
          navigate('/dashboard');
        } else if (error.response?.status === 404) {
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