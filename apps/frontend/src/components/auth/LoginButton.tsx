import React from 'react';
import { Button, ButtonProps } from '@mui/material';
import { Login } from '@mui/icons-material';
import { useAuth0Context } from '../../contexts/Auth0Context';

interface LoginButtonProps extends Omit<ButtonProps, 'onClick'> {
  children?: React.ReactNode;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ 
  children = 'Login', 
  variant = 'contained',
  color = 'primary',
  startIcon = <Login />,
  ...props 
}) => {
  const { loginWithRedirect } = useAuth0Context();

  const handleLogin = () => {
    loginWithRedirect();
  };

  return (
    <Button
      variant={variant}
      color={color}
      startIcon={startIcon}
      onClick={handleLogin}
      {...props}
    >
      {children}
    </Button>
  );
}; 