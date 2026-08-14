import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import ErrorPage from '../pages/ErrorPage';

const ProfileRouter: React.FC = () => {
  const { isAuthenticated, user } = useAuth0();
  const navigate = useNavigate();
  const {
    loading,
    error,
    userType,
    isProfileComplete,
    refetch,
    needsContextSelection,
    isDelegationContext,
    delegations,
    personas,
  } = useUserProfileContext();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    if (!loading) {
      const isUserNotFound = error === 'Profile not found';
      const hasDelegationsOnly =
        personas.length === 0 && delegations.length > 0;

      if (isUserNotFound && !hasDelegationsOnly) {
        navigate('/complete-profile');
        return;
      }

      if (!isProfileComplete && !hasDelegationsOnly) {
        navigate('/complete-profile');
        return;
      }

      if (needsContextSelection) {
        navigate('/select-persona');
        return;
      }

      if (isDelegationContext) {
        navigate('/delegate/orders');
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
    }
  }, [
    isAuthenticated,
    loading,
    error,
    userType,
    isProfileComplete,
    needsContextSelection,
    isDelegationContext,
    delegations,
    personas,
    navigate,
    user,
  ]);

  if (loading) {
    return (
      <LoadingPage
        message="Checking your profile"
        subtitle="Please wait while we verify your account"
        showProgress={true}
      />
    );
  }

  if (error && error !== 'Profile not found') {
    return <ErrorPage error={error} onRetry={refetch} />;
  }

  return (
    <LoadingPage message="Loading" subtitle="Please wait" showProgress={true} />
  );
};

export default ProfileRouter;
