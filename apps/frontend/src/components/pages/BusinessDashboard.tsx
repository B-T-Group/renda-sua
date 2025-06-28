import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container, Paper, Typography } from '@mui/material';
import React from 'react';

const BusinessDashboard: React.FC = () => {
  const { user } = useAuth0();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Business Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back, {user?.name}! This is your business dashboard.
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Business Features Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The business dashboard is under development. You'll be able to:
        </Typography>
        <Box component="ul" sx={{ mt: 2, pl: 3 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            Manage inventory and products
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            View and process orders
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Track sales and revenue
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Manage business locations
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            View customer analytics
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default BusinessDashboard;
