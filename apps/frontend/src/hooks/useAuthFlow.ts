import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSessionAuth } from '../contexts/SessionAuthContext';
import { useUserProfileContext } from '../contexts/UserProfileContext';

export const useAuthFlow = () => {
  const { isLoading } = useAuth0();
  const { isAuthenticated, user } = useSessionAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    userType,
    isProfileComplete,
    needsPersonaSelection,
    needsContextSelection,
    isDelegationContext,
    delegations,
    personas,
  } = useUserProfileContext();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  useEffect(() => {
    // Only run auth flow on /app route or when user first authenticates
    if (!isAuthenticated || !user) return;
    if (!['/app', '/app/'].includes(location.pathname)) return;

    setIsCheckingProfile(true);

    // Wait for profile to be loaded
    if (!profileLoading) {
      if (!isAuthenticated) {
        navigate('/');
        return;
      }

      const hasDelegationsOnly =
        personas.length === 0 && delegations.length > 0;

      if (profileError === 'Profile not found' && !hasDelegationsOnly) {
        navigate('/complete-profile');
      } else if (profile && (isProfileComplete || hasDelegationsOnly)) {
        if (needsContextSelection || needsPersonaSelection) {
          navigate('/select-persona');
          setIsCheckingProfile(false);
          return;
        }
        if (isDelegationContext) {
          navigate('/delegate/orders');
          setIsCheckingProfile(false);
          return;
        }
        switch (userType) {
          case 'client': {
            const firstLogin = user?.['https://groupe-bt.com/first_login'];
            if (firstLogin === false || firstLogin === undefined) {
              navigate('/items');
            } else {
              navigate('/dashboard');
            }
            break;
          }
          case 'agent':
            navigate('/dashboard');
            break;
          case 'business':
            navigate('/dashboard');
            break;
          default:
            if (delegations.length > 0) {
              navigate('/select-persona');
            } else {
              navigate('/complete-profile');
            }
            break;
        }
      } else if (profile && !isProfileComplete && !hasDelegationsOnly) {
        navigate('/complete-profile');
      } else if (profileError && profileError !== 'Profile not found') {
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
    needsPersonaSelection,
    needsContextSelection,
    isDelegationContext,
    delegations,
    personas,
    location.pathname,
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
