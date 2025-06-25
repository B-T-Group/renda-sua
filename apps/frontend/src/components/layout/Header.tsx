import React from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import Logo from '../common/Logo';
import LoginButton from '../auth/LoginButton';
import LogoutButton from '../auth/LogoutButton';
import { useAuth0 } from '@auth0/auth0-react';

const Header: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <AppBar position="static" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <RouterLink to="/" style={{ textDecoration: 'none' }}>
              <Logo variant="default" color="white" size="medium" />
            </RouterLink>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isAuthenticated ? (
              <>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/dashboard"
                  sx={{ display: { xs: 'none', md: 'block' } }}
                >
                  Dashboard
                </Button>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/profile"
                  sx={{ display: { xs: 'none', md: 'block' } }}
                >
                  Profile
                </Button>
                <LogoutButton />
              </>
            ) : (
              <LoginButton />
            )}
            
            {isMobile && (
              <Button
                color="inherit"
                sx={{ minWidth: 'auto', p: 1 }}
              >
                <MenuIcon />
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header; 