import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';

const HomePage = lazy(() => import('../pages/HomePage'));

/**
 * Root path `/`: anonymous visitors see the marketing homepage; authenticated
 * clients go to the catalog; agents and businesses go to the dashboard.
 */
const SmartHome: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated } = useSessionAuth();
  const {
    loading,
    userType,
    needsPersonaSelection,
    isProfileComplete,
  } = useUserProfileContext();

  if (isAuthenticated && loading) {
    return (
      <LoadingPage
        message="Loading"
        subtitle="Please wait"
        showProgress={true}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingPage message="Loading" subtitle="Please wait" showProgress />}>
        <HomePage />
      </Suspense>
    );
  }

  if (!isProfileComplete) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (needsPersonaSelection) {
    return <Navigate to="/select-persona" replace />;
  }

  if (userType === 'client') {
    return (
      <Navigate
        to={{ pathname: '/items', search: location.search }}
        replace
      />
    );
  }

  if (userType === 'agent' || userType === 'business') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Navigate to={{ pathname: '/items', search: location.search }} replace />
  );
};

export default SmartHome;
