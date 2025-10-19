import React from 'react';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import AgentDashboard from '../pages/AgentDashboard';
import BusinessDashboard from '../pages/BusinessDashboard';
import Dashboard from '../pages/Dashboard';

const SmartDashboard: React.FC = () => {
  const { profile, loading } = useUserProfileContext();

  if (loading) {
    return (
      <LoadingPage
        message="Loading Dashboard"
        subtitle="Determining your dashboard based on your account type"
        showProgress={true}
      />
    );
  }

  // Route to appropriate dashboard based on user type
  if (profile?.agent) {
    return <AgentDashboard />;
  }

  if (profile?.business) {
    return <BusinessDashboard />;
  }

  if (profile?.client) {
    return <Dashboard />;
  }

  // Fallback to client dashboard if no specific type is found
  return <Dashboard />;
};

export default SmartDashboard;
