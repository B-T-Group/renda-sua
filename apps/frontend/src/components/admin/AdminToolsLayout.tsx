import {
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { findSelectedAdminPath } from '../../constants/adminModuleSections';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import AdminToolsNav from './AdminToolsNav';

/** Wide enough for FR admin labels without ellipsis on a single line. */
const NAV_WIDTH = 300;

function AccessDenied() {
  const { t } = useTranslation();
  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      <Alert severity="error">
        <Typography variant="h6" color="text.secondary">
          {t(
            'business.dashboard.adminAccessDenied',
            'You do not have access to admin tools.'
          )}
        </Typography>
      </Alert>
    </Box>
  );
}

function MobileAdminBar({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ mb: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <IconButton
        edge="start"
        onClick={onOpen}
        aria-label={t('business.dashboard.adminMenuTitle', 'Admin tools')}
      >
        <MenuIcon />
      </IconButton>
      <Typography variant="subtitle1" fontWeight={600}>
        {t('business.dashboard.adminMenuTitle', 'Admin tools')}
      </Typography>
    </Stack>
  );
}

function DesktopSideNav({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <Box
      component="nav"
      sx={{
        width: NAV_WIDTH,
        flexShrink: 0,
        position: 'sticky',
        top: 16,
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        pr: 1,
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="overline"
        color="primary"
        fontWeight={700}
        sx={{ display: 'block', mb: 1, px: 1.5 }}
      >
        {t('business.dashboard.adminMenuTitle', 'Admin tools')}
      </Typography>
      {children}
    </Box>
  );
}

function MobileNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': {
          width: Math.min(NAV_WIDTH + 24, 340),
          p: 2,
          boxSizing: 'border-box',
        },
      }}
    >
      <Typography
        variant="overline"
        color="primary"
        fontWeight={700}
        sx={{ display: 'block', mb: 1 }}
      >
        {t('business.dashboard.adminMenuTitle', 'Admin tools')}
      </Typography>
      {children}
    </Drawer>
  );
}

const AdminToolsLayout: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUserProfileContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { aggregates } = useDashboardAggregates(profile?.business?.id);
  const isRentalFocused =
    (profile?.business?.main_interest ?? 'sell_items') === 'rent_items';
  const { adminModules, hasAdminAccess } = useBusinessDashboardModules({
    aggregates,
    isRentalFocused,
  });

  const selectedPath = useMemo(
    () => findSelectedAdminPath(location.pathname, adminModules),
    [location.pathname, adminModules]
  );

  if (!hasAdminAccess) return <AccessDenied />;

  const nav = (
    <AdminToolsNav
      modules={adminModules}
      selectedPath={selectedPath}
      search={search}
      onSearchChange={setSearch}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <Box sx={{ mb: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 1.5 }}
        size="small"
      >
        {t('business.dashboard.backToDashboard', 'Back to dashboard')}
      </Button>

      {isMobile ? (
        <MobileAdminBar onOpen={() => setDrawerOpen(true)} />
      ) : null}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: { xs: 0, md: 3 },
        }}
      >
        {!isMobile ? <DesktopSideNav>{nav}</DesktopSideNav> : null}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Outlet context={{ adminSearch: search, setAdminSearch: setSearch }} />
        </Box>
      </Box>

      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {nav}
      </MobileNavDrawer>
    </Box>
  );
};

export default AdminToolsLayout;
