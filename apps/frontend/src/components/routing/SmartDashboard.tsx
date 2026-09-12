import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { DashboardComposingPersona } from '../../hooks/useDashboardComposingSession';
import { useDashboardComposingSession } from '../../hooks/useDashboardComposingSession';
import DashboardComposingOverlay from '../common/DashboardComposingOverlay';
import LoadingPage from '../common/LoadingPage';
import AgentDashboard from '../pages/AgentDashboard';
import BusinessDashboard from '../pages/BusinessDashboard';

function resolveComposingPersona(
  userType: string | null,
  isDelegationContext: boolean
): DashboardComposingPersona | null {
  if (isDelegationContext) return 'delegate';
  // Client lands on /items; composing overlay is owned by ItemsPage.
  if (userType === 'agent' || userType === 'business') {
    return userType;
  }
  return null;
}

const SmartDashboard: React.FC = () => {
  const location = useLocation();
  const { loading, userType, isDelegationContext } = useUserProfileContext();
  const composingPersona = resolveComposingPersona(
    userType,
    isDelegationContext
  );
  const { showComposing } = useDashboardComposingSession(
    composingPersona,
    loading
  );

  if (showComposing && composingPersona) {
    return <DashboardComposingOverlay persona={composingPersona} />;
  }

  if (loading) {
    return (
      <LoadingPage
        message="Loading Dashboard"
        subtitle="Determining your dashboard based on your account type"
        showProgress={true}
      />
    );
  }

  if (isDelegationContext) {
    return <Navigate to="/delegate/orders" replace />;
  }

  switch (userType) {
    case 'agent':
      return <AgentDashboard />;
    case 'business':
      return <BusinessDashboard />;
    case 'client':
      return (
        <Navigate
          to={{ pathname: '/items', search: location.search }}
          replace
        />
      );
    default:
      return <AgentDashboard />;
  }
};

export default SmartDashboard;
