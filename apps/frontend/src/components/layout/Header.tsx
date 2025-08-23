import { useAuth0 } from '@auth0/auth0-react';
import { Description, Menu, Person } from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu as MenuComponent,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoginButton from '../auth/LoginButton';
import LogoutButton from '../auth/LogoutButton';
import HeaderSearch from '../common/HeaderSearch';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Logo from '../common/Logo';

const Header: React.FC = () => {
  const { isAuthenticated, user } = useAuth0();
  const { userType, profile } = useUserProfileContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State for mobile drawer and user menu
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const getNavigationItems = () => {
    if (!isAuthenticated) {
      return [
        { label: 'Store', path: '/items' },
        { label: 'Support', path: '/support' },
      ];
    }

    const baseItems = [
      { label: 'Home', path: '/' },
      { label: 'Dashboard', path: '/app' },
    ];

    // Add role-specific navigation
    if (userType === 'business') {
      baseItems.push(
        { label: 'Orders', path: '/orders' },
        { label: 'Items', path: '/business/items' },
        { label: 'Locations', path: '/business/locations' },
        { label: 'Documents', path: '/documents' },
        { label: 'Messages', path: '/messages' }
      );
    } else if (userType === 'client') {
      baseItems.push(
        { label: 'Orders', path: '/orders' },
        { label: 'Documents', path: '/documents' },
        { label: 'Messages', path: '/messages' }
      );
    } else if (userType === 'agent') {
      baseItems.push(
        { label: 'My Orders', path: '/orders' },
        { label: 'Documents', path: '/documents' },
        { label: 'Messages', path: '/messages' }
      );
    }

    return baseItems;
  };

  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (profile?.business?.name) {
      return profile.business.name;
    }
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return user?.name || user?.email || 'User';
  };

  const NavigationButton = ({ item }: { item: any }) => (
    <Button
      component={RouterLink}
      to={item.path}
      sx={{
        color: isActiveRoute(item.path) ? '#000' : '#1d1d1f',
        textTransform: 'none',
        fontWeight: 400,
        fontSize: '0.875rem',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        px: 2,
        py: 1,
        minWidth: 'auto',
        borderRadius: 0,
        transition: 'color 0.2s ease-in-out',
        '&:hover': {
          color: '#000',
          backgroundColor: 'transparent',
        },
        '&:after': {
          content: '""',
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: isActiveRoute(item.path) ? '100%' : '0%',
          height: '2px',
          backgroundColor: '#007aff',
          transition: 'width 0.3s ease-in-out',
        },
        position: 'relative',
        '&:hover:after': {
          width: '100%',
        },
      }}
    >
      {item.label}
    </Button>
  );

  const MobileDrawer = () => (
    <Drawer
      variant="temporary"
      anchor="right"
      open={mobileOpen}
      onClose={handleDrawerToggle}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile.
      }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: 280,
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Logo variant="compact" color="primary" size="medium" />
      </Box>

      <List sx={{ pt: 1 }}>
        {getNavigationItems().map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              onClick={handleDrawerToggle}
              selected={isActiveRoute(item.path)}
              sx={{
                borderRadius: 1,
                mx: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: '#1e40af',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#1e3a8a',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}

        <Divider sx={{ my: 2 }} />

        <ListItem>
          <LanguageSwitcher />
        </ListItem>

        {isAuthenticated && (
          <>
            <Divider sx={{ my: 2 }} />
            <ListItem disablePadding>
              <ListItemButton
                component={RouterLink}
                to="/profile"
                onClick={handleDrawerToggle}
                sx={{ borderRadius: 1, mx: 1 }}
              >
                <ListItemIcon>
                  <Person />
                </ListItemIcon>
                <ListItemText primary={t('auth.profile')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <LogoutButton />
            </ListItem>
          </>
        )}
      </List>
    </Drawer>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: 'rgba(251, 251, 253, 0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          color: '#1d1d1f',
          '& .MuiToolbar-root': {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Container maxWidth="xl" disableGutters>
          <Toolbar
            disableGutters
            sx={{
              minHeight: { xs: 48, md: 48 },
              px: { xs: 2, md: 4 },
              justifyContent: 'space-between',
            }}
          >
            {/* Logo Section */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <RouterLink to="/" style={{ textDecoration: 'none' }}>
                <Logo variant="compact" color="primary" size="small" />
              </RouterLink>
            </Box>

            {/* Desktop Navigation */}
            {!isMobile && (
              <Stack
                direction="row"
                spacing={0}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                {getNavigationItems().map((item) => (
                  <NavigationButton key={item.path} item={item} />
                ))}
              </Stack>
            )}

            {/* Right Section */}
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Search */}
              <Box sx={{ position: 'relative' }}>
                <HeaderSearch />
              </Box>

              {/* Language Switcher */}
              <LanguageSwitcher />

              {isAuthenticated ? (
                <>
                  {/* User Menu */}
                  <IconButton
                    onClick={handleUserMenuOpen}
                    size="small"
                    sx={{
                      color: '#1d1d1f',
                      padding: '6px',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: '0.75rem',
                        backgroundColor: '#007aff',
                        color: 'white',
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      }}
                    >
                      {getUserInitials()}
                    </Avatar>
                  </IconButton>

                  <MenuComponent
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={handleUserMenuClose}
                    PaperProps={{
                      sx: {
                        mt: 1,
                        minWidth: 200,
                        borderRadius: 2,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {getUserDisplayName()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {userType === 'business'
                          ? 'Business Account'
                          : userType === 'client'
                          ? 'Client Account'
                          : 'User Account'}
                      </Typography>
                    </Box>

                    <MenuItem
                      component={RouterLink}
                      to="/profile"
                      onClick={handleUserMenuClose}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon>
                        <Person fontSize="small" />
                      </ListItemIcon>
                      {t('auth.profile')}
                    </MenuItem>

                    <MenuItem
                      component={RouterLink}
                      to="/documents"
                      onClick={handleUserMenuClose}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon>
                        <Description fontSize="small" />
                      </ListItemIcon>
                      Documents
                    </MenuItem>

                    <Divider />

                    <MenuItem onClick={handleUserMenuClose}>
                      <LogoutButton />
                    </MenuItem>
                  </MenuComponent>
                </>
              ) : (
                <LoginButton />
              )}

              {/* Mobile Menu Button */}
              {isMobile && (
                <IconButton
                  onClick={handleDrawerToggle}
                  size="small"
                  sx={{
                    color: '#1d1d1f',
                    padding: '8px',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <Menu fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      <MobileDrawer />
    </>
  );
};

export default Header;
