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
    if (!isAuthenticated || !user || !apiClient) return;
    
    setIsCheckingProfile(true);
    
    // Reduce timeout to 3 seconds for faster loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    // Try to get user profile from backend
    apiClient.get('/users/me', { signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        // If successful, user has a complete profile, redirect to dashboard
        navigate('/dashboard');
      })
      .catch((error) => {
        clearTimeout(timeoutId);
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
      })
      .finally(() => {
        setIsCheckingProfile(false);
      });
    
  }, [isAuthenticated, user, apiClient, navigate]);

  return {
    isCheckingProfile,
    isAuthenticated,
    isLoading,
    user,
  };
}; 