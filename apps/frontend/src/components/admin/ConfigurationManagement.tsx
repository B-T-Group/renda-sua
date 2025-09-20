import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApplicationConfiguration,
  useApplicationConfigurations,
} from '../../hooks/useApplicationConfigurations';
import { ConfigurationEditDialog } from './ConfigurationEditDialog';

export const ConfigurationManagement: React.FC = () => {
  const { t } = useTranslation();
  const {
    configurations,
    loading,
    error,
    fetchConfigurations,
    updateConfiguration,
    deleteConfiguration,
    refreshConfigurations,
  } = useApplicationConfigurations();

  const [editingConfiguration, setEditingConfiguration] =
    useState<ApplicationConfiguration | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] =
    useState<ApplicationConfiguration | null>(null);
  const [filterCountryCode, setFilterCountryCode] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleEdit = (config: ApplicationConfiguration) => {
    setEditingConfiguration(config);
  };

  const handleDelete = (config: ApplicationConfiguration) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  };

  const handleSaveConfiguration = async (id: string, updates: any) => {
    setActionLoading(id);
    try {
      await updateConfiguration(id, updates);
      await refreshConfigurations();
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!configToDelete) return;

    setActionLoading(configToDelete.id);
    try {
      await deleteConfiguration(configToDelete.id);
      await refreshConfigurations();
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFilterChange = () => {
    const tags = filterTags
      ? filterTags.split(',').map((t) => t.trim())
      : undefined;
    fetchConfigurations(
      filterCountryCode || undefined,
      filterStatus || undefined,
      tags
    );
  };

  const getValueDisplay = (config: ApplicationConfiguration): string => {
    switch (config.data_type) {
      case 'string':
      case 'currency':
        return config.string_value || '-';
      case 'number':
        return config.number_value?.toString() || '-';
      case 'boolean':
        return config.boolean_value ? 'true' : 'false';
      case 'json':
        return config.json_value ? JSON.stringify(config.json_value) : '-';
      case 'array':
        return config.array_value?.join(', ') || '-';
      case 'date':
        return config.date_value || '-';
      default:
        return '-';
    }
  };

  const getStatusColor = (
    status: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'deprecated':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredConfigurations = configurations.filter((config) => {
    if (filterCountryCode && config.country_code !== filterCountryCode)
      return false;
    if (filterStatus && config.status !== filterStatus) return false;
    if (filterTags) {
      const filterTagsArray = filterTags
        .split(',')
        .map((t) => t.trim().toLowerCase());
      const configTags = (config.tags || []).map((t) => t.toLowerCase());
      return filterTagsArray.some((tag) => configTags.includes(tag));
    }
    return true;
  });

  if (loading && configurations.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 3 }}
          >
            <Typography variant="h5" component="h2">
              {t('admin.configurations.title', 'Application Configurations')}
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={refreshConfigurations}
                disabled={loading}
              >
                {t('common.refresh', 'Refresh')}
              </Button>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
            >
              <FilterIcon />
              <TextField
                size="small"
                label={t(
                  'admin.configurations.filterCountryCode',
                  'Country Code'
                )}
                value={filterCountryCode}
                onChange={(e) => setFilterCountryCode(e.target.value)}
                placeholder="e.g., CM, US"
                sx={{ minWidth: 150 }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>
                  {t('admin.configurations.filterStatus', 'Status')}
                </InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label={t('admin.configurations.filterStatus', 'Status')}
                >
                  <MenuItem value="">{t('common.all', 'All')}</MenuItem>
                  <MenuItem value="active">
                    {t('admin.configurations.statuses.active', 'Active')}
                  </MenuItem>
                  <MenuItem value="inactive">
                    {t('admin.configurations.statuses.inactive', 'Inactive')}
                  </MenuItem>
                  <MenuItem value="deprecated">
                    {t(
                      'admin.configurations.statuses.deprecated',
                      'Deprecated'
                    )}
                  </MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('admin.configurations.filterTags', 'Tags')}
                value={filterTags}
                onChange={(e) => setFilterTags(e.target.value)}
                placeholder="e.g., delivery, pricing"
                sx={{ minWidth: 200 }}
              />
              <Button
                variant="contained"
                onClick={handleFilterChange}
                disabled={loading}
              >
                {t('common.filter', 'Filter')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setFilterCountryCode('');
                  setFilterStatus('');
                  setFilterTags('');
                  fetchConfigurations();
                }}
              >
                {t('common.clear', 'Clear')}
              </Button>
            </Stack>
          </Paper>

          {/* Configurations Table */}
          <TableContainer component={Paper}>
            <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      {t('admin.configurations.table.name', 'Name')}
                    </TableCell>
                    <TableCell>
                      {t('admin.configurations.table.type', 'Type')}
                    </TableCell>
                    <TableCell>
                      {t('admin.configurations.table.value', 'Value')}
                    </TableCell>
                    <TableCell>
                      {t('admin.configurations.table.country', 'Country')}
                    </TableCell>
                    <TableCell>
                      {t('admin.configurations.table.status', 'Status')}
                    </TableCell>
                    <TableCell>
                      {t('admin.configurations.table.tags', 'Tags')}
                    </TableCell>
                    <TableCell>
                      {t('admin.configurations.table.version', 'Version')}
                    </TableCell>
                    <TableCell align="center">
                      {t('common.actions', 'Actions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {filteredConfigurations.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {config.config_key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {config.config_name}
                      </Typography>
                      {config.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {config.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={config.data_type}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={getValueDisplay(config)}
                      >
                        {getValueDisplay(config)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {config.country_code ? (
                        <Chip label={config.country_code} size="small" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t('admin.configurations.global', 'Global')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={config.status}
                        size="small"
                        color={getStatusColor(config.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {config.tags?.slice(0, 2).map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {config.tags && config.tags.length > 2 && (
                          <Chip
                            label={`+${config.tags.length - 2}`}
                            size="small"
                            variant="outlined"
                            color="default"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">v{config.version}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        <Tooltip title={t('common.edit', 'Edit')}>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(config)}
                            disabled={actionLoading === config.id}
                          >
                            {actionLoading === config.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <EditIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete', 'Delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(config)}
                            disabled={actionLoading === config.id}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredConfigurations.length === 0 && !loading && (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                {t(
                  'admin.configurations.noConfigurations',
                  'No configurations found'
                )}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <ConfigurationEditDialog
        open={!!editingConfiguration}
        onClose={() => setEditingConfiguration(null)}
        configuration={editingConfiguration}
        onSave={handleSaveConfiguration}
        loading={!!actionLoading}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          {t('admin.configurations.deleteTitle', 'Delete Configuration')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t(
              'admin.configurations.deleteMessage',
              'Are you sure you want to delete this configuration? This action cannot be undone.'
            )}
          </Typography>
          {configToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2">
                {configToDelete.config_key}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {configToDelete.config_name}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={!!actionLoading}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
