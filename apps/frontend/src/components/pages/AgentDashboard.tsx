import { Container, Grid } from '@mui/material';
import React from 'react';
import { useAgentEarningsSummary } from '../../hooks/useAgentEarningsSummary';
import AgentAddressPrompt from '../common/AgentAddressPrompt';
import AgentEarningsWidget from '../common/AgentEarningsWidget';
import AgentQuickStats from '../common/AgentQuickStats';
import OpenOrdersPage from './OpenOrdersPage';

/**
 * AgentDashboard component that shows available orders for agents to claim,
 * today's earnings, and quick stats.
 * Note: Agent onboarding is handled globally in App.tsx
 */
const AgentDashboard: React.FC = () => {
  const { summary, loading, error } = useAgentEarningsSummary(true);

  return (
    <>
      <AgentAddressPrompt />
      <Container maxWidth="lg" sx={{ py: 1.5, width: '100%' }}>
        <Grid container spacing={1.5} sx={{ width: '100%' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <AgentEarningsWidget summary={summary} loading={loading} error={error} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <AgentQuickStats summary={summary} loading={loading} error={error} />
          </Grid>
        </Grid>
      </Container>
      <OpenOrdersPage />
    </>
  );
};

export default AgentDashboard;
