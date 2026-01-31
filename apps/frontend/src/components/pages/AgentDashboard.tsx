import React from 'react';
import AgentAddressPrompt from '../common/AgentAddressPrompt';
import OpenOrdersPage from './OpenOrdersPage';

/**
 * AgentDashboard component that shows available orders for agents to claim
 * Note: Agent onboarding is handled globally in App.tsx
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
