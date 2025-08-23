import React from 'react';
import { useUserProfile } from '../../hooks/useUserProfile';
import LoadingPage from '../common/LoadingPage';
import BusinessOrdersPage from '../pages/BusinessOrdersPage';
import ClientOrders from '../pages/ClientOrders';

const SmartOrders: React.FC = () => {
  const { profile, loading } = useUserProfile();

  if (loading) {
    return (
      <LoadingPage
        message="Loading Orders"
        subtitle="Determining your orders view based on your account type"
        showProgress={true}
      />
    );
  }

  // Route to appropriate orders page based on user type
  if (profile?.business) {
    return <BusinessOrdersPage />;
  }

  if (profile?.client) {
    return <ClientOrders />;
  }

  if (profile?.agent) {
    // For agents, we can redirect to client orders for now
    // or create a specific agent orders page later
    return <ClientOrders />;
  }

  // Fallback to client orders if no specific type is found
  return <ClientOrders />;
};

export default SmartOrders;
