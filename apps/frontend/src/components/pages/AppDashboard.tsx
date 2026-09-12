import React from 'react';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { DashboardComposingPersona } from '../../hooks/useDashboardComposingSession';
import { useDashboardComposingSession } from '../../hooks/useDashboardComposingSession';
import DashboardComposingOverlay from '../common/DashboardComposingOverlay';
import LoadingPage from '../common/LoadingPage';
import AgentDashboard from './AgentDashboard';
import BusinessDashboard from './BusinessDashboard';
import CompleteProfile from './CompleteProfile';
import Dashboard from './Dashboard';

function resolveComposingPersona(
  userType: string | null
): DashboardComposingPersona | null {
  if (userType === 'client' || userType === 'agent' || userType === 'business') {
    return userType;
  }
  return null;
}

const AppDashboard: React.FC = () => {
  const { loading, error, userType, isProfileComplete } =
    useUserProfileContext();
  const composingPersona = resolveComposingPersona(userType);
  const { showComposing } = useDashboardComposingSession(
    composingPersona,
    loading
  );

  if (showComposing && composingPersona) {
    return <DashboardComposingOverlay persona={composingPersona} />;
  }

  // Show loading while checking profile
  if (loading) {
    return (
      <LoadingPage
        message="Loading your dashboard"
        subtitle="Please wait while we prepare your experience"
        showProgress={true}
      />
    );
  }

  // If there's an error or profile is incomplete, redirect to complete profile
  if (error || !isProfileComplete) {
    return <CompleteProfile />;
  }

  // Render the appropriate dashboard based on user type
  switch (userType) {
    case 'client':
      return <Dashboard />;
    case 'agent':
      return <AgentDashboard />;
    case 'business':
      return <BusinessDashboard />;
    default:
      // Unknown user type, redirect to complete profile
      return <CompleteProfile />;
  }
};

export default AppDashboard;
