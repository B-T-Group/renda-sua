import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import AgentDashboard from '../pages/AgentDashboard';
import BusinessDashboard from '../pages/BusinessDashboard';

const SmartDashboard: React.FC = () => {
  const location = useLocation();
  const { loading, userType } = useUserProfileContext();

  if (loading) {
    return (
      <LoadingPage
        message="Loading Dashboard"
        subtitle="Determining your dashboard based on your account type"
        showProgress={true}
      />
    );
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
