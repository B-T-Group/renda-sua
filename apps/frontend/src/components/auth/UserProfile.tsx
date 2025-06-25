import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { 
  Card, 
  CardContent, 
  Typography, 
  Avatar, 
  Box, 
  Chip,
  Divider 
} from "@mui/material";
import { Person, Email, VerifiedUser } from "@mui/icons-material";

const UserProfile = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography variant="body1" color="text.secondary">
          Loading user profile...
        </Typography>
      </Box>
    );
  }

  return (
    isAuthenticated && user && (
      <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
        <CardContent>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <Avatar
              src={user.picture}
              alt={user.name}
              sx={{ width: 80, height: 80, mb: 2 }}
            />
            <Typography variant="h5" component="h2" gutterBottom>
              {user.name}
            </Typography>
            <Chip
              icon={<VerifiedUser />}
              label="Authenticated"
              color="success"
              variant="outlined"
            />
            <Divider sx={{ width: '100%', my: 2 }} />
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <Email color="action" />
              <Typography variant="body1" color="text.secondary">
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
          </Box>
        </CardContent>
      </Card>
    )
  );
};

export default UserProfile; 