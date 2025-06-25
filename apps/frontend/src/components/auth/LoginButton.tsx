import React from 'react';
import { Button } from '@mui/material';
import { Login } from '@mui/icons-material';
import { useAuth0 } from '@auth0/auth0-react';

const LoginButton: React.FC = () => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname },
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