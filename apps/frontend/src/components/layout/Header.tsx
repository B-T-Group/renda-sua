import { useAuth0 } from '@auth0/auth0-react';
import {
  Dashboard,
  Home,
  Inventory,
  LocationOn,
  Menu,
  Person,
  ShoppingCart,
  Store,
} from '@mui/icons-material';
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
  Tooltip,
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
        {
          label: t('public.items.title'),
          path: '/items',
          icon: <Store />,
        },
      ];
    }

    const items = [
      {
        label: t('common.home'),
        path: '/',
        icon: <Home />,
      },
      {
        label: t('business.dashboard.title'),
        path: '/app',
        icon: <Dashboard />,
      },
    ];

    // Add business-specific navigation
    if (userType === 'business') {
      items.push(
        {
          label: t('business.orders.title'),
          path: '/business/orders',
          icon: <ShoppingCart />,
        },
        {
          label: t('business.items.title'),
          path: '/business/items',
          icon: <Inventory />,
        },
        {
          label: t('business.locations.title'),
          path: '/business/locations',
          icon: <LocationOn />,
        }
      );
    }

    // Add client-specific navigation
    if (userType === 'client') {
      items.push({
        label: t('business.orders.title'),
        path: '/client-orders',
        icon: <ShoppingCart />,
      });
    }

    return items;
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
      startIcon={item.icon}
      sx={{
        color: '#1e40af',
        textTransform: 'none',
        fontWeight: 500,
        px: 2,
        py: 1,
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        backgroundColor: isActiveRoute(item.path)
          ? 'rgba(30, 64, 175, 0.1)'
          : 'transparent',
        '&:hover': {
          backgroundColor: 'rgba(30, 64, 175, 0.15)',
          transform: 'translateY(-1px)',
        },
        '&.active': {
          backgroundColor: 'rgba(30, 64, 175, 0.2)',
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
          backgroundColor: 'white',
          backdropFilter: 'blur(10px)',
          borderBottom: '2px solid #1e40af',
          boxShadow: '0 2px 12px rgba(30, 64, 175, 0.1)',
          '& .MuiToolbar-root': {
            backgroundColor: 'white',
          },
        }}
      >
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{
              minHeight: { xs: 64, md: 72 },
              py: { xs: 1, md: 1.5 },
            }}
          >
            {/* Logo Section */}
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <RouterLink to="/" style={{ textDecoration: 'none' }}>
                <Logo variant="compact" color="primary" size="medium" />
              </RouterLink>
            </Box>

            {/* Desktop Navigation */}
            {!isMobile && (
              <Stack direction="row" spacing={1} sx={{ mr: 3 }}>
                {getNavigationItems().map((item) => (
                  <NavigationButton key={item.path} item={item} />
                ))}
              </Stack>
            )}

            {/* Right Section */}
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Language Switcher */}
              <Tooltip title={t('common.language')}>
                <Box>
                  <LanguageSwitcher />
                </Box>
              </Tooltip>

              {isAuthenticated ? (
                <>
                  {/* User Menu */}
                  <Tooltip title={getUserDisplayName()}>
                    <IconButton
                      onClick={handleUserMenuOpen}
                      sx={{
                        color: '#1e40af',
                        backgroundColor: 'rgba(30, 64, 175, 0.1)',
                        '&:hover': {
                          backgroundColor: 'rgba(30, 64, 175, 0.2)',
                        },
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.875rem',
                          backgroundColor: '#1e40af',
                          color: 'white',
                        }}
                      >
                        {getUserInitials()}
                      </Avatar>
                    </IconButton>
                  </Tooltip>

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
                  color="inherit"
                  aria-label="open drawer"
                  edge="end"
                  onClick={handleDrawerToggle}
                  sx={{
                    ml: 1,
                    color: '#1e40af',
                    backgroundColor: 'rgba(30, 64, 175, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(30, 64, 175, 0.2)',
                    },
                  }}
                >
                  <Menu />
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
