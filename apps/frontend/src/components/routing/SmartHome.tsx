import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { DashboardComposingPersona } from '../../hooks/useDashboardComposingSession';
import { useDashboardComposingSession } from '../../hooks/useDashboardComposingSession';
import DashboardComposingOverlay from '../common/DashboardComposingOverlay';
import LoadingPage from '../common/LoadingPage';

const HomePage = lazy(() => import('../pages/HomePage'));

function resolveComposingPersona(
  userType: string | null,
  isDelegationContext: boolean
): DashboardComposingPersona | null {
  if (isDelegationContext) return 'delegate';
  // Client home is /items — composing runs there on first catalog paint.
  if (userType === 'agent' || userType === 'business') {
    return userType;
  }
  return null;
}

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
    needsContextSelection,
    isProfileComplete,
    isDelegationContext,
    delegations,
    personas,
  } = useUserProfileContext();

  const composingPersona = resolveComposingPersona(
    userType,
    isDelegationContext
  );
  const { showComposing } = useDashboardComposingSession(
    isAuthenticated ? composingPersona : null,
    isAuthenticated && loading
  );

  if (showComposing && composingPersona) {
    return <DashboardComposingOverlay persona={composingPersona} />;
  }

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

  const hasDelegationsOnly = personas.length === 0 && delegations.length > 0;

  if (!isProfileComplete && !hasDelegationsOnly) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (needsContextSelection || needsPersonaSelection) {
    return <Navigate to="/select-persona" replace />;
  }

  if (isDelegationContext) {
    return <Navigate to="/delegate/orders" replace />;
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

  if (delegations.length > 0) {
    return <Navigate to="/select-persona" replace />;
  }

  return (
    <Navigate to={{ pathname: '/items', search: location.search }} replace />
  );
};

export default SmartHome;
