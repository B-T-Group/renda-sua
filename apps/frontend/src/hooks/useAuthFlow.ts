import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../contexts/UserProfileContext';

export const useAuthFlow = () => {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const navigate = useNavigate();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    userType,
    isProfileComplete,
  } = useUserProfileContext();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    setIsCheckingProfile(true);

    // Wait for profile to be loaded
    if (!profileLoading) {
      // Check if user profile exists
      if (profileError === 'Profile not found') {
        // User doesn't have a profile, redirect to complete profile
        navigate('/complete-profile');
      } else if (profile && isProfileComplete) {
        // User has a complete profile, redirect to appropriate dashboard
        switch (userType) {
          case 'client':
            navigate('/dashboard');
            break;
          case 'agent':
            navigate('/agent-dashboard');
            break;
          case 'business':
            navigate('/business-dashboard');
            break;
          default:
            // Unknown user type, redirect to complete profile
            navigate('/complete-profile');
            break;
        }
      } else if (profile && !isProfileComplete) {
        // User has a profile but it's incomplete, redirect to complete profile
        navigate('/complete-profile');
      } else if (profileError && profileError !== 'Profile not found') {
        // Other error occurred, redirect to dashboard as fallback
        console.error('Error checking user profile:', profileError);
        navigate('/dashboard');
      }

      setIsCheckingProfile(false);
    }
  }, [
    isAuthenticated,
    user,
    profile,
    profileLoading,
    profileError,
    userType,
    isProfileComplete,
    navigate,
  ]);

  return {
    isCheckingProfile: isCheckingProfile || profileLoading,
    isAuthenticated,
    isLoading,
    user,
    profile,
    userType,
    isProfileComplete,
  };
};
