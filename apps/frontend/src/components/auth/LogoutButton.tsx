import React from 'react';
import { Button, ButtonProps } from '@mui/material';
import { Logout } from '@mui/icons-material';
import { useAuth0Context } from '../../contexts/Auth0Context';

interface LogoutButtonProps extends Omit<ButtonProps, 'onClick'> {
  children?: React.ReactNode;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({ 
  children = 'Logout', 
  variant = 'outlined',
  color = 'secondary',
  startIcon = <Logout />,
  ...props 
}) => {
  const { logout } = useAuth0Context();

  const handleLogout = () => {
    logout();
  };

  return (
    <Button
      variant={variant}
      color={color}
      startIcon={startIcon}
      onClick={handleLogout}
      {...props}
    >
      {children}
    </Button>
  );
}; 