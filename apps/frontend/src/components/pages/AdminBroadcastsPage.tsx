import CampaignIcon from '@mui/icons-material/Campaign';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { usePermission } from '../../hooks/usePermissions';
import {
  type BroadcastAudienceType,
  type BroadcastCampaign,
  type BroadcastFilters,
  type BroadcastPreviewResult,
  type BroadcastTemplateKey,
  type BroadcastUserOption,
  useAdminBroadcasts,
} from '../../hooks/useAdminBroadcasts';
import ConfirmationModal from '../common/ConfirmationModal';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

const LIFECYCLE_OPTIONS = [
  'created',
  'contract_signed',
  'active',
  'suspended',
] as const;

const APP_UPGRADE_BODY_EN =
  'A new version of Rendasua is available. Update the app to get the latest features, fixes, and improvements.';
const ACCOUNT_SETUP_BODY_EN =
  'Your catalog looks ready. Complete your payment account setup so you can start receiving orders on Rendasua.';

const STATUS_COLOR: Record<
  string,
  'default' | 'warning' | 'success' | 'error' | 'info'
> = {
  queued: 'info',
  processing: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

const AdminBroadcastsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading } = useUserProfileContext();
  const canAccess = usePermission(PlatformPermissions.OPS_USER_MESSAGES);
  const { preview, create, list, searchUsers, loading, error } =
    useAdminBroadcasts();

  const [audienceType, setAudienceType] =
    useState<BroadcastAudienceType>('everyone');
  const [templateKey, setTemplateKey] =
    useState<BroadcastTemplateKey>('app_upgrade');
  const [title, setTitle] = useState(
    t('admin.broadcasts.templates.appUpgradeTitle', 'Update Rendasua')
  );
  const [body, setBody] = useState(APP_UPGRADE_BODY_EN);
  const [lifecycleStatuses, setLifecycleStatuses] = useState<string[]>([]);
  const [canAcceptOrders, setCanAcceptOrders] = useState<boolean | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [countries, setCountries] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<BroadcastUserOption[]>([]);
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userOptions, setUserOptions] = useState<BroadcastUserOption[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [previewResult, setPreviewResult] =
    useState<BroadcastPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [items, setItems] = useState<BroadcastCampaign[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  const filters: BroadcastFilters = useMemo(() => {
    const f: BroadcastFilters = {};
    if (audienceType === 'user') {
      f.userIds = selectedUsers.map((u) => u.id);
      f.emails = selectedUsers.map((u) => u.email);
      return f;
    }
    if (audienceType === 'business') {
      if (lifecycleStatuses.length) f.lifecycleStatuses = lifecycleStatuses;
      if (canAcceptOrders !== null) f.canAcceptOrders = canAcceptOrders;
    }
    if (audienceType === 'agent' && isAvailable !== null) {
      f.isAvailable = isAvailable;
    }
    const codes = countries
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length) f.countries = codes;
    return f;
  }, [
    audienceType,
    lifecycleStatuses,
    canAcceptOrders,
    isAvailable,
    countries,
    selectedUsers,
  ]);

  const applyTemplateDefaults = useCallback(
    (audience: BroadcastAudienceType, template: BroadcastTemplateKey) => {
      if (template === 'app_upgrade') {
        setTitle(
          t('admin.broadcasts.templates.appUpgradeTitle', 'Update Rendasua')
        );
        setBody(APP_UPGRADE_BODY_EN);
        return;
      }
      if (template === 'business_account_setup') {
        setTitle(
          t(
            'admin.broadcasts.templates.accountSetupTitle',
            'Finish payment setup'
          )
        );
        setBody(ACCOUNT_SETUP_BODY_EN);
        if (audience === 'business' && lifecycleStatuses.length === 0) {
          setLifecycleStatuses(['contract_signed']);
        }
        return;
      }
      setTitle('');
      setBody('');
    },
    [t, lifecycleStatuses.length]
  );

  const onAudienceChange = (
    _: React.MouseEvent<HTMLElement>,
    value: BroadcastAudienceType | null
  ) => {
    if (!value) return;
    setAudienceType(value);
    if (value === 'everyone') {
      setTemplateKey('app_upgrade');
      applyTemplateDefaults(value, 'app_upgrade');
    } else if (value === 'business') {
      setTemplateKey('business_account_setup');
      applyTemplateDefaults(value, 'business_account_setup');
    } else {
      setTemplateKey('custom');
      applyTemplateDefaults(value, 'custom');
    }
    if (value !== 'user') {
      setSelectedUsers([]);
      setUserSearchInput('');
      setUserOptions([]);
    }
  };

  useEffect(() => {
    if (audienceType !== 'user') return;
    const q = userSearchInput.trim();
    if (q.length < 2) {
      setUserOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      setUserSearchLoading(true);
      void searchUsers(q)
        .then(setUserOptions)
        .finally(() => setUserSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [audienceType, userSearchInput, searchUsers]);

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const result = await preview({
        audienceType,
        filters,
        templateKey,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      setPreviewResult(result);
    } catch {
      setPreviewResult(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [preview, audienceType, filters, templateKey, title, body]);

  const refreshHistory = useCallback(async () => {
    const result = await list(page + 1, rowsPerPage);
    setItems(result.items);
    setTotal(result.pagination.total);
  }, [list, page, rowsPerPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [refreshPreview]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const handleSend = async () => {
    if (audienceType === 'user' && selectedUsers.length === 0) {
      enqueueSnackbar(
        t(
          'admin.broadcasts.selectUserRequired',
          'Select at least one user by email before sending.'
        ),
        { variant: 'warning' }
      );
      setConfirmOpen(false);
      return;
    }
    try {
      await create({
        audienceType,
        filters,
        templateKey,
        title: title.trim() || undefined,
        body: body.trim(),
        sourceLanguage: i18n.language?.startsWith('fr') ? 'fr' : 'en',
      });
      enqueueSnackbar(
        t('admin.broadcasts.sendSuccess', 'Broadcast queued successfully'),
        { variant: 'success' }
      );
      setConfirmOpen(false);
      await refreshHistory();
      await refreshPreview();
    } catch {
      enqueueSnackbar(
        t('admin.broadcasts.sendError', 'Failed to send broadcast'),
        { variant: 'error' }
      );
    }
  };

  if (profileLoading) return <LoadingScreen />;

  if (!canAccess || !profile?.business) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">
            {t(
              'admin.broadcasts.unauthorized',
              'You do not have permission to send admin broadcasts.'
            )}
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <SEOHead
        title={t('admin.broadcasts.pageTitle', 'Global messaging')}
        description={t(
          'admin.broadcasts.pageDescription',
          'Send targeted notifications to Rendasua users'
        )}
      />
      <Box sx={{ py: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <CampaignIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            {t('admin.broadcasts.title', 'Global messaging')}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t(
            'admin.broadcasts.subtitle',
            'Target users by persona and filters, preview the audience, then send a bilingual push notification.'
          )}
        </Typography>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            {t('admin.broadcasts.compose', 'Compose')}
          </Typography>

          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('admin.broadcasts.audience', 'Audience')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={audienceType}
            onChange={onAudienceChange}
            size="small"
            sx={{ mb: 2, flexWrap: 'wrap' }}
          >
            {(
              [
                ['everyone', 'Everyone'],
                ['business', 'Business'],
                ['agent', 'Agent'],
                ['client', 'Client'],
                ['user', 'Specific user'],
              ] as const
            ).map(([value, label]) => (
              <ToggleButton key={value} value={value}>
                {t(`admin.broadcasts.audienceTypes.${value}`, label)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {audienceType === 'user' ? (
            <Autocomplete
              multiple
              sx={{ mb: 2 }}
              options={userOptions}
              value={selectedUsers}
              loading={userSearchLoading}
              filterOptions={(x) => x}
              getOptionLabel={(option) =>
                [option.email, option.firstName, option.lastName]
                  .filter(Boolean)
                  .join(' · ')
              }
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, value) => setSelectedUsers(value)}
              inputValue={userSearchInput}
              onInputChange={(_, value, reason) => {
                if (reason !== 'reset') setUserSearchInput(value);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={t(
                    'admin.broadcasts.searchUserEmail',
                    'Search user by email'
                  )}
                  placeholder={t(
                    'admin.broadcasts.searchUserEmailPlaceholder',
                    'Type an email address…'
                  )}
                  helperText={t(
                    'admin.broadcasts.searchUserEmailHelp',
                    'Find and select one or more users to message directly.'
                  )}
                />
              )}
            />
          ) : null}

          {audienceType === 'business' ? (
            <Stack spacing={2} sx={{ mb: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>
                  {t('admin.broadcasts.lifecycleStatus', 'Lifecycle status')}
                </InputLabel>
                <Select
                  multiple
                  label={t(
                    'admin.broadcasts.lifecycleStatus',
                    'Lifecycle status'
                  )}
                  value={lifecycleStatuses}
                  onChange={(e) =>
                    setLifecycleStatuses(
                      typeof e.target.value === 'string'
                        ? e.target.value.split(',')
                        : (e.target.value as string[])
                    )
                  }
                >
                  {LIFECYCLE_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={canAcceptOrders === true}
                      onChange={(_, checked) =>
                        setCanAcceptOrders(checked ? true : null)
                      }
                    />
                  }
                  label={t(
                    'admin.broadcasts.canAcceptOrders',
                    'Can accept orders only'
                  )}
                />
              </Stack>
            </Stack>
          ) : null}

          {audienceType === 'agent' ? (
            <FormControlLabel
              sx={{ mb: 2 }}
              control={
                <Switch
                  checked={isAvailable === true}
                  onChange={(_, checked) =>
                    setIsAvailable(checked ? true : null)
                  }
                />
              }
              label={t(
                'admin.broadcasts.availableAgentsOnly',
                'Available agents only'
              )}
            />
          ) : null}

          {audienceType !== 'user' ? (
            <TextField
              size="small"
              fullWidth
              sx={{ mb: 2 }}
              label={t(
                'admin.broadcasts.countries',
                'Primary address countries (comma-separated)'
              )}
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              placeholder="CM, GA, CA"
            />
          ) : null}

          <FormControl size="small" fullWidth sx={{ mb: 2 }}>
            <InputLabel>
              {t('admin.broadcasts.template', 'Template')}
            </InputLabel>
            <Select
              label={t('admin.broadcasts.template', 'Template')}
              value={templateKey}
              onChange={(e) => {
                const next = e.target.value as BroadcastTemplateKey;
                setTemplateKey(next);
                applyTemplateDefaults(audienceType, next);
              }}
            >
              <MenuItem value="custom">
                {t('admin.broadcasts.templates.custom', 'Custom')}
              </MenuItem>
              <MenuItem value="app_upgrade">
                {t('admin.broadcasts.templates.appUpgrade', 'App upgrade')}
              </MenuItem>
              <MenuItem value="business_account_setup">
                {t(
                  'admin.broadcasts.templates.accountSetup',
                  'Business account setup'
                )}
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            label={t('admin.broadcasts.messageTitle', 'Title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={4}
            sx={{ mb: 2 }}
            label={t('admin.broadcasts.messageBody', 'Message')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {t('admin.broadcasts.audiencePreview', 'Audience preview')}
                </Typography>
                {previewLoading ? (
                  <CircularProgress size={18} sx={{ mt: 1 }} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('admin.broadcasts.previewSummary', {
                      defaultValue:
                        '{{total}} users · {{push}} with push · {{skip}} skipped by 7-day rule · {{eligible}} eligible',
                      total: previewResult?.total ?? 0,
                      push: previewResult?.withPushToken ?? 0,
                      skip: previewResult?.wouldSkipDedupe ?? 0,
                      eligible: previewResult?.eligible ?? 0,
                    })}
                  </Typography>
                )}
              </Box>
              <Button
                variant="contained"
                disabled={!body.trim() || loading || (previewResult?.total ?? 0) === 0}
                onClick={() => setConfirmOpen(true)}
              >
                {t('admin.broadcasts.send', 'Send broadcast')}
              </Button>
            </Stack>
          </Paper>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('admin.broadcasts.history', 'Campaign history')}
            </Typography>
          </Box>
          <Divider />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t('admin.broadcasts.createdAt', 'Created')}
                  </TableCell>
                  <TableCell>
                    {t('admin.broadcasts.audience', 'Audience')}
                  </TableCell>
                  <TableCell>
                    {t('admin.broadcasts.template', 'Template')}
                  </TableCell>
                  <TableCell>
                    {t('admin.broadcasts.status', 'Status')}
                  </TableCell>
                  <TableCell>
                    {t('admin.broadcasts.counts', 'Sent / skipped / failed')}
                  </TableCell>
                  <TableCell>
                    {t('admin.broadcasts.message', 'Message')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {row.audience_type === 'user' &&
                      row.filters?.emails?.length
                        ? `${t(
                            'admin.broadcasts.audienceTypes.user',
                            'Specific user'
                          )}: ${row.filters.emails.join(', ')}`
                        : row.audience_type}
                    </TableCell>
                    <TableCell>{row.template_key}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.status}
                        color={STATUS_COLOR[row.status] ?? 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {row.sent_count}/{row.skipped_dedupe_count}/
                      {row.failed_count}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" noWrap>
                        {row.title_en || row.source_title || row.source_body}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        align="center"
                        sx={{ py: 3 }}
                      >
                        {t(
                          'admin.broadcasts.emptyHistory',
                          'No broadcasts sent yet'
                        )}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Paper>
      </Box>

      <ConfirmationModal
        open={confirmOpen}
        title={t('admin.broadcasts.confirmTitle', 'Send broadcast?')}
        message={t('admin.broadcasts.confirmMessage', {
          defaultValue:
            'Send to {{eligible}} eligible users ({{total}} matched, {{skip}} will be skipped by the 7-day rule)?',
          eligible: previewResult?.eligible ?? 0,
          total: previewResult?.total ?? 0,
          skip: previewResult?.wouldSkipDedupe ?? 0,
        })}
        confirmText={t('admin.broadcasts.send', 'Send broadcast')}
        loading={loading}
        onConfirm={() => void handleSend()}
        onCancel={() => setConfirmOpen(false)}
      />
    </Container>
  );
};

export default AdminBroadcastsPage;
