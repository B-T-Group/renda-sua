import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import OrdersPage from '../pages/OrdersPage';

const SmartOrders: React.FC = () => {
  const { isDelegationContext } = useUserProfileContext();
  if (isDelegationContext) {
    return <Navigate to="/delegate/orders" replace />;
  }
  return <OrdersPage />;
};

export default SmartOrders;
