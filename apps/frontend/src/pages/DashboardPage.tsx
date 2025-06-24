import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Refresh, Person, DirectionsCar } from '@mui/icons-material';
import { useAuth0Context } from '../contexts/Auth0Context';
import { apiClient } from '../services/apiClient';
import { hasuraClient } from '../services/hasuraClient';
import { UserProfile } from '../components/auth/UserProfile';
import { LogoutButton } from '../components/auth/LogoutButton';

interface UserType {
  id: string;
  comment: string;
}

interface VehicleType {
  id: string;
  comment: string;
}

interface User {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type_id: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  user_types?: T[];
  vehicle_types?: T[];
  user?: T;
}

export const DashboardPage: React.FC = () => {
  const { user: auth0User } = useAuth0Context();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState({
    userTypes: false,
    vehicleTypes: false,
    currentUser: false,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchUserTypes = async () => {
    setLoading(prev => ({ ...prev, userTypes: true }));
    try {
      const response = await apiClient.getUserTypes() as ApiResponse<UserType>;
      setUserTypes(response.user_types || []);
    } catch (err: any) {
      setError(`Failed to fetch user types: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, userTypes: false }));
    }
  };

  const fetchVehicleTypes = async () => {
    setLoading(prev => ({ ...prev, vehicleTypes: true }));
    try {
      const response = await apiClient.getVehicleTypes() as ApiResponse<VehicleType>;
      setVehicleTypes(response.vehicle_types || []);
    } catch (err: any) {
      setError(`Failed to fetch vehicle types: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, vehicleTypes: false }));
    }
  };

  const fetchCurrentUser = async () => {
    setLoading(prev => ({ ...prev, currentUser: true }));
    try {
      const response = await apiClient.getCurrentUser() as ApiResponse<User>;
      setCurrentUser(response.user || null);
    } catch (err: any) {
      setError(`Failed to fetch current user: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, currentUser: false }));
    }
  };

  const fetchAllData = () => {
    setError(null);
    fetchUserTypes();
    fetchVehicleTypes();
    fetchCurrentUser();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Dashboard
          </Typography>
          <LogoutButton />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <UserProfile />
      </Box>

      <Grid container spacing={3}>
        {/* User Types */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  User Types
                </Typography>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={fetchUserTypes}
                  disabled={loading.userTypes}
                >
                  Refresh
                </Button>
              </Box>
              
              {loading.userTypes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <List dense>
                  {userTypes.map((userType) => (
                    <ListItem key={userType.id}>
                      <ListItemText
                        primary={userType.id}
                        secondary={userType.comment}
                      />
                      <Chip label={userType.id} size="small" />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Vehicle Types */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Vehicle Types
                </Typography>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={fetchVehicleTypes}
                  disabled={loading.vehicleTypes}
                >
                  Refresh
                </Button>
              </Box>
              
              {loading.vehicleTypes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <List dense>
                  {vehicleTypes.map((vehicleType) => (
                    <ListItem key={vehicleType.id}>
                      <ListItemText
                        primary={vehicleType.id}
                        secondary={vehicleType.comment}
                      />
                      <Chip label={vehicleType.id} size="small" />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Current User */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Current User (Backend API)
                </Typography>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={fetchCurrentUser}
                  disabled={loading.currentUser}
                >
                  Refresh
                </Button>
              </Box>
              
              {loading.currentUser ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : currentUser ? (
                <Box>
                  <Typography variant="body1" gutterBottom>
                    <strong>Name:</strong> {currentUser.first_name} {currentUser.last_name}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Email:</strong> {currentUser.email}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Identifier:</strong> {currentUser.identifier}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>User Type:</strong> {currentUser.user_type_id}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Created:</strong> {new Date(currentUser.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No user data found. You may need to create a user profile first.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}; 