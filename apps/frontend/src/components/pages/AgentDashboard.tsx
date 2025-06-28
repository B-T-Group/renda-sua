import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container, Paper, Typography } from '@mui/material';
import React from 'react';

const AgentDashboard: React.FC = () => {
  const { user } = useAuth0();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Agent Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back, {user?.name}! This is your agent dashboard.
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Agent Features Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The agent dashboard is under development. You'll be able to:
        </Typography>
        <Box component="ul" sx={{ mt: 2, pl: 3 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            View assigned delivery orders
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Update order status
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Manage delivery routes
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Track earnings and performance
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default AgentDashboard;
