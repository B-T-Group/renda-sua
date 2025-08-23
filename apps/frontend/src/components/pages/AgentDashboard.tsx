import React from 'react';
import OrdersPage from './OrdersPage';

/**
 * AgentDashboard component that uses the generic OrdersPage
 * with agent-specific functionality automatically enabled
 */
const AgentDashboard: React.FC = () => {
  return <OrdersPage />;
};

export default AgentDashboard;
