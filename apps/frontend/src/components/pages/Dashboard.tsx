import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp,
  People,
  Business,
  Notifications,
  Schedule,
} from '@mui/icons-material';
import { useAuth0 } from '@auth0/auth0-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth0();

  const stats = [
    { title: 'Total Revenue', value: '$45,231', icon: <TrendingUp color="primary" /> },
    { title: 'Active Users', value: '2,350', icon: <People color="primary" /> },
    { title: 'Businesses', value: '12', icon: <Business color="primary" /> },
  ];

  const recentActivities = [
    { text: 'New user registration', time: '2 minutes ago' },
    { text: 'Payment processed', time: '1 hour ago' },
    { text: 'System update completed', time: '3 hours ago' },
    { text: 'New business added', time: '1 day ago' },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back, {user?.name}! Here's what's happening with your account.
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 3,
          mb: 4,
        }}
      >
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    {stat.title}
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stat.value}
                  </Typography>
                </Box>
                <Box sx={{ color: 'primary.main' }}>
                  {stat.icon}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
          },
          gap: 3,
        }}
      >
        {/* Quick Actions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Business />
              </ListItemIcon>
              <ListItemText primary="Manage Businesses" />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <People />
              </ListItemIcon>
              <ListItemText primary="View Users" />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <Schedule />
              </ListItemIcon>
              <ListItemText primary="Schedule Tasks" />
            </ListItem>
          </List>
        </Paper>

        {/* Recent Activity */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <List>
            {recentActivities.map((activity, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    <Notifications color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={activity.text}
                    secondary={activity.time}
                  />
                </ListItem>
                {index < recentActivities.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      </Box>
    </Container>
  );
};

export default Dashboard; 