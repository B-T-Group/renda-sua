import React from 'react';
import OrdersPage from '../pages/OrdersPage';

const SmartOrders: React.FC = () => {
  // The OrdersPage component is now generic and handles all user types
  return <OrdersPage />;
};

export default SmartOrders;
