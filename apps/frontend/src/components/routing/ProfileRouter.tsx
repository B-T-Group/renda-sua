import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../../hooks';
import LoadingPage from '../common/LoadingPage';
import ErrorPage from '../pages/ErrorPage';

const ProfileRouter: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const { loading, error, userType, isProfileComplete, refetch } =
    useUserProfile();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    if (!loading) {
      // Check if user is not found (404) or profile is incomplete
      const isUserNotFound = error === 'Profile not found';
      const shouldCompleteProfile = isUserNotFound || !isProfileComplete;

      if (shouldCompleteProfile) {
        // User not found or profile incomplete, redirect to complete profile
        navigate('/complete-profile');
        return;
      }

      // Profile is complete, route based on user type
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
    }
  }, [isAuthenticated, loading, error, userType, isProfileComplete, navigate]);

  // Show loading while checking profile
  if (loading) {
    return (
      <LoadingPage
        message="Checking your profile"
        subtitle="Please wait while we verify your account"
        showProgress={true}
      />
    );
  }

  // Show error page if there's an error (but not for 404/user not found)
  if (error && error !== 'Profile not found') {
    return <ErrorPage error={error} onRetry={refetch} />;
  }

  // This should not be reached, but just in case
  return (
    <LoadingPage message="Loading" subtitle="Please wait" showProgress={true} />
  );
};

export default ProfileRouter;
