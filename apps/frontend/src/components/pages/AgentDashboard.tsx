import React from 'react';
import AgentAddressPrompt from '../common/AgentAddressPrompt';
import OpenOrdersPage from './OpenOrdersPage';

/**
 * AgentDashboard component that shows available orders for agents to claim
 * Redirects to the OpenOrdersPage for order discovery workflow
 */
const AgentDashboard: React.FC = () => {
  return (
    <>
      <AgentAddressPrompt />
      <OpenOrdersPage />
    </>
  );
};

export default AgentDashboard;
