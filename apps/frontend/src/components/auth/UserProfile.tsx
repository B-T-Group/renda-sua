import React from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import { Person, Email } from '@mui/icons-material';
import { useAuth0Context } from '../../contexts/Auth0Context';

export const UserProfile: React.FC = () => {
  const { user, isAuthenticated } = useAuth0Context();

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            src={user.picture}
            alt={user.name}
            sx={{ width: 64, height: 64, mr: 2 }}
          >
            <Person />
          </Avatar>
          <Box>
            <Typography variant="h6" component="h2">
              {user.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Email fontSize="small" color="action" />
            <Typography variant="body2">
              {user.email}
            </Typography>
          </Box>
          
          {user.email_verified && (
            <Chip 
              label="Email Verified" 
              color="success" 
              size="small" 
              variant="outlined"
            />
          )}
          
          {user.sub && (
            <Typography variant="caption" color="text.secondary">
              ID: {user.sub}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}; 