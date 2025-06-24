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
  useTheme,
} from '@mui/material';
import { Refresh, Person, DirectionsCar, Dashboard as DashboardIcon } from '@mui/icons-material';
import { useAuth0Context } from '../contexts/Auth0Context';
import { apiClient } from '../services/apiClient';
import { hasuraClient } from '../services/hasuraClient';
import { UserProfile } from '../components/auth/UserProfile';
import { LogoutButton } from '../components/auth/LogoutButton';
import { Logo } from '../components/common/Logo';

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
  const theme = useTheme();
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          py: 3,
          mb: 4,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Logo height={50} sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Dashboard
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Transport & Logistics Management
                </Typography>
              </Box>
            </Box>
            <LogoutButton />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* User Profile */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <DashboardIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                    User Profile
                  </Typography>
                </Box>
                <UserProfile />
              </CardContent>
            </Card>
          </Grid>

          {/* User Types */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Person sx={{ fontSize: 28, color: 'primary.main', mr: 1 }} />
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                      User Types
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<Refresh />}
                    onClick={fetchUserTypes}
                    disabled={loading.userTypes}
                    sx={{ borderRadius: 2 }}
                  >
                    Refresh
                  </Button>
                </Box>
                
                {loading.userTypes ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <List dense>
                    {userTypes.map((userType) => (
                      <ListItem key={userType.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={userType.id}
                          secondary={userType.comment}
                        />
                        <Chip label={userType.id} size="small" color="primary" />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Vehicle Types */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <DirectionsCar sx={{ fontSize: 28, color: 'secondary.main', mr: 1 }} />
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                      Vehicle Types
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<Refresh />}
                    onClick={fetchVehicleTypes}
                    disabled={loading.vehicleTypes}
                    sx={{ borderRadius: 2 }}
                  >
                    Refresh
                  </Button>
                </Box>
                
                {loading.vehicleTypes ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <List dense>
                    {vehicleTypes.map((vehicleType) => (
                      <ListItem key={vehicleType.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={vehicleType.id}
                          secondary={vehicleType.comment}
                        />
                        <Chip label={vehicleType.id} size="small" color="secondary" />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Current User */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Person sx={{ fontSize: 28, color: 'info.main', mr: 1 }} />
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                      Current User (Backend API)
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<Refresh />}
                    onClick={fetchCurrentUser}
                    disabled={loading.currentUser}
                    sx={{ borderRadius: 2 }}
                  >
                    Refresh
                  </Button>
                </Box>
                
                {loading.currentUser ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : currentUser ? (
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                    gap: 2,
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 2,
                  }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      <strong>Name:</strong> {currentUser.first_name} {currentUser.last_name}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      <strong>Email:</strong> {currentUser.email}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      <strong>Identifier:</strong> {currentUser.identifier}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      <strong>User Type:</strong> {currentUser.user_type_id}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      <strong>Created:</strong> {new Date(currentUser.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No user data found. You may need to create a user profile first.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}; 