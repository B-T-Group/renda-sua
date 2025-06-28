import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../../hooks';
import LoadingPage from '../common/LoadingPage';
import CompleteProfile from '../pages/CompleteProfile';
import Dashboard from '../pages/Dashboard';
import AgentDashboard from '../pages/AgentDashboard';
import BusinessDashboard from '../pages/BusinessDashboard';
import ErrorPage from '../pages/ErrorPage';

const ProfileRouter: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const { profile, loading, error, userType, isProfileComplete, refetch } =
    useUserProfile();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    if (!loading && !error) {
      if (!isProfileComplete) {
        // Profile is not complete, redirect to complete profile
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

  // Show error page if there's an error
  if (error) {
    return <ErrorPage error={error} onRetry={refetch} />;
  }

  // This should not be reached, but just in case
  return (
    <LoadingPage message="Loading" subtitle="Please wait" showProgress={true} />
  );
};

export default ProfileRouter;
