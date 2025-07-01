import { useAuth0 } from '@auth0/auth0-react';
import { Login } from '@mui/icons-material';
import { Button } from '@mui/material';
import React from 'react';

const LoginButton: React.FC = () => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: '/app' }, // Redirect to /app after login for profile checking
    });
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={<Login />}
      onClick={handleLogin}
      sx={{
        px: 3,
        py: 1,
        fontSize: '1rem',
        fontWeight: 600,
      }}
    >
      Sign In
    </Button>
  );
};

export default LoginButton;
