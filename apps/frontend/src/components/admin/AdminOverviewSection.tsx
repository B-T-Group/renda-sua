import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import React, { cloneElement, isValidElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { BusinessDashboardModule } from '../business/BusinessDashboardModuleCard';
import type { AdminModuleGroup } from '../../constants/adminModuleSections';
import { ADMIN_SECTION_LABELS } from '../../constants/adminModuleSections';

function ModuleRowIcon({
  icon,
  color,
}: {
  icon: React.ReactNode;
  color: string;
}) {
  if (isValidElement<{ sx?: object }>(icon)) {
    return cloneElement(icon, { sx: { fontSize: 28, color } });
  }
  return <>{icon}</>;
}

function ModuleCountBadge({
  mod,
  loading,
}: {
  mod: BusinessDashboardModule;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (mod.count === null) return null;
  if (loading) return <Skeleton width={28} height={20} />;
  const verified = mod.countBreakdown
    ? ` · ${t('business.dashboard.verified', 'Verified')}: ${mod.countBreakdown.verified}`
    : '';
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ bgcolor: 'action.hover', px: 0.75, py: 0.15, borderRadius: 1 }}
    >
      {mod.count}
      {verified}
    </Typography>
  );
}

function AdminOverviewSection({
  group,
  loading,
}: {
  group: AdminModuleGroup;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const labels = ADMIN_SECTION_LABELS[group.section];

  return (
    <Paper
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography
          variant="overline"
          color="primary"
          fontWeight={700}
          letterSpacing={0.08}
        >
          {t(labels.key, labels.fallback)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(labels.hintKey, labels.hintFallback)}
        </Typography>
      </Box>
      <List disablePadding>
        {group.modules.map((mod, index) => (
          <ListItemButton
            key={mod.path}
            component={Link}
            to={mod.path}
            divider={index < group.modules.length - 1}
            sx={{ py: 1.25, px: 2, alignItems: 'flex-start' }}
          >
            <ListItemIcon sx={{ minWidth: 44, mt: 0.25 }}>
              <ModuleRowIcon icon={mod.icon} color={mod.color} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle1" fontWeight={600}>
                    {mod.title}
                  </Typography>
                  <ModuleCountBadge mod={mod} loading={loading} />
                </Stack>
              }
              secondary={mod.description}
              secondaryTypographyProps={{
                variant: 'body2',
                color: 'text.secondary',
                sx: {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                },
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}

export default AdminOverviewSection;
