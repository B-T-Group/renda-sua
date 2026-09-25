import {
  Dashboard as DashboardIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Box,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { cloneElement, isValidElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { BusinessDashboardModule } from '../business/BusinessDashboardModuleCard';
import {
  ADMIN_SECTION_LABELS,
  groupAdminModules,
} from '../../constants/adminModuleSections';

export interface AdminToolsNavProps {
  modules: BusinessDashboardModule[];
  selectedPath: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onNavigate?: () => void;
}

const OVERVIEW_PATH = '/business/dashboard/admin';

function NavIcon({
  icon,
  color,
}: {
  icon: React.ReactNode;
  color: string;
}) {
  if (isValidElement<{ sx?: object }>(icon)) {
    return cloneElement(icon, {
      sx: { fontSize: 20, color },
    });
  }
  return <Box sx={{ color, display: 'flex' }}>{icon}</Box>;
}

const AdminToolsNav: React.FC<AdminToolsNavProps> = ({
  modules,
  selectedPath,
  search,
  onSearchChange,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const groups = groupAdminModules(modules, search);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        size="small"
        fullWidth
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t(
          'business.dashboard.adminSearchPlaceholder',
          'Search tools…'
        )}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        inputProps={{
          'aria-label': t(
            'business.dashboard.adminSearchPlaceholder',
            'Search tools…'
          ),
        }}
      />

      <List dense disablePadding sx={{ width: '100%' }}>
        <ListItemButton
          component={Link}
          to={OVERVIEW_PATH}
          selected={selectedPath === OVERVIEW_PATH}
          onClick={onNavigate}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <DashboardIcon sx={{ fontSize: 20 }} color="action" />
          </ListItemIcon>
          <ListItemText
            primary={t('business.dashboard.adminOverview', 'Overview')}
          />
        </ListItemButton>

        {groups.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2, py: 1.5 }}
          >
            {t('business.dashboard.adminSearchEmpty', 'No tools match.')}
          </Typography>
        ) : (
          groups.map((group) => {
            const labels = ADMIN_SECTION_LABELS[group.section];
            return (
              <React.Fragment key={group.section}>
                <ListSubheader
                  disableSticky
                  sx={{
                    bgcolor: 'transparent',
                    lineHeight: 2,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    letterSpacing: 0.06,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    px: 1.5,
                    mt: 1,
                  }}
                >
                  {t(labels.key, labels.fallback)}
                </ListSubheader>
                {group.modules.map((mod) => (
                  <Tooltip
                    key={mod.path}
                    title={mod.title}
                    placement="right"
                    enterDelay={600}
                  >
                    <ListItemButton
                      component={Link}
                      to={mod.path}
                      selected={selectedPath === mod.path}
                      onClick={onNavigate}
                      sx={{ alignItems: 'flex-start', py: 0.75 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                        <NavIcon icon={mod.icon} color={mod.color} />
                      </ListItemIcon>
                      <ListItemText
                        primary={mod.title}
                        primaryTypographyProps={{
                          variant: 'body2',
                          sx: {
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: 1.35,
                          },
                        }}
                      />
                    </ListItemButton>
                  </Tooltip>
                ))}
              </React.Fragment>
            );
          })
        )}
      </List>
    </Box>
  );
};

export default AdminToolsNav;
