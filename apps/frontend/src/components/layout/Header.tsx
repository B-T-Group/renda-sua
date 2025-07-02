import { useAuth0 } from '@auth0/auth0-react';
import { Menu as MenuIcon } from '@mui/icons-material';
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoginButton from '../auth/LoginButton';
import LogoutButton from '../auth/LogoutButton';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Logo from '../common/Logo';

const Header: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const { userType } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <AppBar position="static" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ py: 2 }}>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <RouterLink to="/" style={{ textDecoration: 'none' }}>
              <Logo variant="compact" color="white" size="medium" />
            </RouterLink>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Language Switcher */}
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/app"
                  sx={{ display: { xs: 'none', md: 'block' } }}
                >
                  Dashboard
                </Button>

                {/* Show Orders link for clients */}
                {userType === 'client' && (
                  <Button
                    color="inherit"
                    component={RouterLink}
                    to="/client-orders"
                    sx={{ display: { xs: 'none', md: 'block' } }}
                  >
                    My Orders
                  </Button>
                )}

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
              <Button color="inherit" sx={{ minWidth: 'auto', p: 1 }}>
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
