import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import AgentDashboard from '../pages/AgentDashboard';
import BusinessDashboard from '../pages/BusinessDashboard';

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
    return <Navigate to="/items" replace />;
  }

  // Fallback to agent dashboard if no specific type is found
  return <AgentDashboard />;
};

export default SmartDashboard;
