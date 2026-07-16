import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import {
  useAdminBusinesses,
  type AdminBusinessLifecycleFilter,
  type AdminIdDocumentStatus,
} from '../../hooks/useAdminBusinesses';
import { useAdminRbac } from '../../hooks/useAdminRbac';
import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { AdminBusinessOverviewCard } from '../admin/AdminBusinessOverviewCard';
import { AdminBusinessVerificationDialog } from '../admin/AdminBusinessVerificationDialog';
import { PinCodeFields } from '../common/PinCodeFields';

const LIFECYCLE_FILTERS: AdminBusinessLifecycleFilter[] = [
  '',
  'created',
  'catalog_ready',
  'payment_setup_pending',
  'payment_verification_pending',
  'active',
  'suspended',
];

const ID_STATUS_FILTERS: Array<AdminIdDocumentStatus | ''> = [
  '',
  'pending',
  'rejected',
  'missing',
  'approved',
];

const AdminManageBusinesses: React.FC = () => {
  const apiClient = useApiClient();
  const {
    businesses,
    total,
    page,
    limit,
    search,
    lifecycleStatus,
    idDocumentStatus,
    needsAttention,
    setPage,
    setLimit,
    setSearch,
    setLifecycleStatus,
    setIdDocumentStatus,
    setNeedsAttention,
    loading,
    error,
    fetchBusinesses,
    updateBusiness,
    setWithdrawalPin,
    clearWithdrawalPin,
  } = useAdminBusinesses();
  const {
    roles: platformRoles,
    getUserRoles,
    setUserRoles,
  } = useAdminRbac();
  const canManageRbac = usePermission(PlatformPermissions.RBAC_MANAGE);
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [pinDialogError, setPinDialogError] = useState<string | null>(null);
  const [verificationBusinessId, setVerificationBusinessId] = useState<
    string | null
  >(null);

  const current = useMemo(
    () => businesses.find((b) => b.id === editingId),
    [businesses, editingId]
  );

  const openEdit = async (id: string) => {
    const target = businesses.find((b) => b.id === id);
    setForm({
      first_name: target?.user.first_name || '',
      last_name: target?.user.last_name || '',
      phone_number: target?.user.phone_number || '',
      name: target?.name || '',
      ai_tokens: target?.ai_tokens ?? 20,
      withdrawal_pin_enabled: target?.withdrawal_pin_enabled ?? false,
    });
    setSelectedRoleKeys([]);
    setPinDialogOpen(false);
    setPinDraft('');
    setPinDialogError(null);
    setEditingId(id);
    if (canManageRbac && target?.user_id) {
      setRolesLoading(true);
      try {
        const keys = await getUserRoles(target.user_id);
        setSelectedRoleKeys(keys);
      } finally {
        setRolesLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!editingId) return;
    const target = businesses.find((b) => b.id === editingId);
    const { is_admin: _ignored, ...payload } = form;
    void _ignored;
    await updateBusiness(editingId, payload);
    if (canManageRbac && target?.user_id) {
      await setUserRoles(target.user_id, selectedRoleKeys);
    }
    setEditingId(null);
  };

  const handleClearPin = async () => {
    if (!editingId) return;
    await clearWithdrawalPin(editingId);
  };

  const handleToggleWithdrawalPinEnabled = (nextEnabled: boolean) => {
    const prevEnabled = !!form.withdrawal_pin_enabled;
    if (!prevEnabled && nextEnabled) {
      setForm((f: any) => ({ ...f, withdrawal_pin_enabled: true }));
      setPinDraft('');
      setPinDialogError(null);
      setPinDialogOpen(true);
      return;
    }
    setForm((f: any) => ({ ...f, withdrawal_pin_enabled: nextEnabled }));
  };

  const handleConfirmPinDialog = async () => {
    if (!editingId) return;
    if (pinDraft.length !== 4) {
      setPinDialogError(
        t(
          'admin.businesses.withdrawalPinDialog.enterPin',
          'Enter a 4-digit PIN.'
        )
      );
      return;
    }
    setPinDialogError(null);
    await setWithdrawalPin(editingId, pinDraft);
    setPinDialogOpen(false);
    setPinDraft('');
  };

  const handleCancelPinDialog = () => {
    setPinDialogOpen(false);
    setPinDraft('');
    setPinDialogError(null);
    setForm((f: any) => ({ ...f, withdrawal_pin_enabled: false }));
  };

  const handleSuspendBusiness = useCallback(
    async (businessId: string) => {
      if (!apiClient) return;
      const reason = window.prompt(
        t('admin.businesses.suspendReasonPrompt', 'Reason for suspension')
      );
      if (!reason?.trim()) return;
      await apiClient.post(`/admin/businesses/${businessId}/suspend`, {
        reason: reason.trim(),
      });
      await fetchBusinesses();
    },
    [apiClient, fetchBusinesses, t]
  );

  const handleReinstateBusiness = useCallback(
    async (businessId: string) => {
      if (!apiClient) return;
      await apiClient.post(`/admin/businesses/${businessId}/reinstate`);
      await fetchBusinesses();
    },
    [apiClient, fetchBusinesses]
  );

  const verificationBusiness = businesses.find(
    (b) => b.id === verificationBusinessId
  );

  const hasActiveFilters = Boolean(
    search || lifecycleStatus || idDocumentStatus || needsAttention
  );

  const lifecycleFilterLabel = (value: AdminBusinessLifecycleFilter) => {
    if (!value) {
      return t('admin.businesses.filters.lifecycleAll', 'All lifecycles');
    }
    const keyMap: Record<string, string> = {
      created: 'draft',
      catalog_ready: 'catalogReady',
      payment_setup_pending: 'paymentSetupPending',
      payment_verification_pending: 'paymentVerificationPending',
      active: 'active',
      suspended: 'suspended',
    };
    const key = keyMap[value] || value;
    return t(`admin.businesses.lifecycle.${key}`, value);
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h5">
            {t('admin.manageBusinesses', 'Manage Businesses')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'admin.businesses.pageSubtitle',
              'Triage merchant lifecycle, ID review, and payment readiness.'
            )}
          </Typography>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={fetchBusinesses}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Box>

      <Card sx={{ mb: 2 }} variant="outlined">
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            '&:last-child': { pb: 2 },
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            flexWrap="wrap"
            useFlexGap
            alignItems="center"
          >
            <TextField
              size="small"
              label={t('common.search', 'Search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 200, flex: '1 1 180px' }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="businesses-lifecycle">
                {t('admin.businesses.filters.lifecycle', 'Lifecycle')}
              </InputLabel>
              <Select
                labelId="businesses-lifecycle"
                label={t('admin.businesses.filters.lifecycle', 'Lifecycle')}
                value={lifecycleStatus}
                onChange={(e) =>
                  setLifecycleStatus(
                    e.target.value as AdminBusinessLifecycleFilter
                  )
                }
              >
                {LIFECYCLE_FILTERS.map((value) => (
                  <MenuItem key={value || 'all'} value={value}>
                    {lifecycleFilterLabel(value)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="businesses-id-status">
                {t('admin.businesses.filters.idDocuments', 'ID documents')}
              </InputLabel>
              <Select
                labelId="businesses-id-status"
                label={t(
                  'admin.businesses.filters.idDocuments',
                  'ID documents'
                )}
                value={idDocumentStatus}
                onChange={(e) =>
                  setIdDocumentStatus(
                    e.target.value as AdminIdDocumentStatus | ''
                  )
                }
              >
                {ID_STATUS_FILTERS.map((value) => (
                  <MenuItem key={value || 'all'} value={value}>
                    {value
                      ? t(`admin.businesses.idStatus.${value}`, value)
                      : t(
                          'admin.businesses.filters.idAll',
                          'All ID statuses'
                        )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={needsAttention}
                  onChange={(e) => setNeedsAttention(e.target.checked)}
                  size="small"
                />
              }
              label={t(
                'admin.businesses.filters.needsAttention',
                'Needs attention'
              )}
            />
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel id="businesses-page-size">
                {t('common.pageSize', 'Page size')}
              </InputLabel>
              <Select
                labelId="businesses-page-size"
                label={t('common.pageSize', 'Page size')}
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {hasActiveFilters ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {search ? (
                <Chip
                  size="small"
                  label={`${t('common.search', 'Search')}: ${search}`}
                  onDelete={() => setSearch('')}
                />
              ) : null}
              {lifecycleStatus ? (
                <Chip
                  size="small"
                  label={lifecycleFilterLabel(lifecycleStatus)}
                  onDelete={() => setLifecycleStatus('')}
                />
              ) : null}
              {idDocumentStatus ? (
                <Chip
                  size="small"
                  label={t(
                    `admin.businesses.idStatus.${idDocumentStatus}`,
                    idDocumentStatus
                  )}
                  onDelete={() => setIdDocumentStatus('')}
                />
              ) : null}
              {needsAttention ? (
                <Chip
                  size="small"
                  color="warning"
                  label={t(
                    'admin.businesses.filters.needsAttention',
                    'Needs attention'
                  )}
                  onDelete={() => setNeedsAttention(false)}
                />
              ) : null}
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      {error && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Typography>{t('common.loading', 'Loading...')}</Typography>
      ) : businesses.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary">
              {hasActiveFilters
                ? t(
                    'admin.businesses.emptyFiltered',
                    'No businesses match these filters.'
                  )
                : t('admin.businesses.empty', 'No businesses found.')}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {businesses.map((b) => (
            <AdminBusinessOverviewCard
              key={b.id}
              business={b}
              onVerify={() => setVerificationBusinessId(b.id)}
              onEdit={() => void openEdit(b.id)}
              onSuspend={() => void handleSuspendBusiness(b.id)}
              onReinstate={() => void handleReinstateBusiness(b.id)}
            />
          ))}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Button
              disabled={page <= 1}
              onClick={() => setPage(Math.max(1, page - 1))}
            >
              {t('common.previous', 'Previous')}
            </Button>
            <Typography variant="body2" color="text.secondary">
              {t('common.pageOfTotal', 'Page {{page}} · {{total}} total', {
                page,
                total,
              })}
            </Typography>
            <Button
              disabled={page * limit >= total}
              onClick={() => setPage(page + 1)}
            >
              {t('common.next', 'Next')}
            </Button>
          </Box>
        </Box>
      )}

      <Dialog
        open={!!editingId}
        onClose={() => setEditingId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={800}>
            {t('admin.businesses.editTitle', 'Edit business')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {current?.name ?? t('admin.businesses.unnamed', 'Business')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 0.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('admin.businesses.section.business', 'Business')}
              </Typography>
              <TextField
                fullWidth
                label={t('admin.businesses.fields.name', 'Business name')}
                value={form.name || ''}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, name: e.target.value }))
                }
              />
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('admin.businesses.section.settings', 'Settings')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                }}
              >
                {canManageRbac && (
                <Box>
                  <Typography fontWeight={600} sx={{ mb: 1 }}>
                    {t('admin.businesses.flags.roles', 'Platform roles')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t(
                      'admin.businesses.flags.rolesHelp',
                      'Assign platform roles for this business owner. Superuser has full access.'
                    )}
                  </Typography>
                  <Autocomplete
                    multiple
                    loading={rolesLoading}
                    options={platformRoles.map((r) => r.key)}
                    value={selectedRoleKeys}
                    onChange={(_e, value) => setSelectedRoleKeys(value)}
                    getOptionLabel={(key) =>
                      platformRoles.find((r) => r.key === key)?.name || key
                    }
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={
                            platformRoles.find((r) => r.key === option)?.name ||
                            option
                          }
                          {...getTagProps({ index })}
                          key={option}
                          size="small"
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder={t(
                          'admin.businesses.flags.rolesPlaceholder',
                          'Select roles'
                        )}
                      />
                    )}
                  />
                </Box>
                )}

                <Box>
                  <Typography fontWeight={600} sx={{ mb: 1 }}>
                    {t('admin.businesses.aiTokens', 'AI tokens')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t(
                      'admin.businesses.aiTokensHelp',
                      'Remaining AI credits for image cleanup. Super users are granted at least 1000.'
                    )}
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    value={form.ai_tokens ?? 0}
                    onChange={(e) =>
                      setForm((f: any) => ({
                        ...f,
                        ai_tokens: Number.parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    inputProps={{ min: 0 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600}>
                      {t(
                        'admin.businesses.withdrawalPinEnabled',
                        'Require withdrawal PIN'
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.businesses.withdrawalPinEnabledHelp',
                        'When enabled, withdrawals require a 4-digit PIN.'
                      )}
                    </Typography>
                  </Box>
                  <Switch
                    checked={!!form.withdrawal_pin_enabled}
                    onChange={(e) =>
                      handleToggleWithdrawalPinEnabled(e.target.checked)
                    }
                  />
                </Box>

                {form.withdrawal_pin_enabled ? (
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setPinDraft('');
                        setPinDialogError(null);
                        setPinDialogOpen(true);
                      }}
                    >
                      {t('admin.businesses.changeWithdrawalPin', 'Change PIN')}
                    </Button>
                    <Button variant="text" color="error" onClick={handleClearPin}>
                      {t('admin.businesses.clearWithdrawalPin', 'Clear PIN')}
                    </Button>
                  </Box>
                ) : null}
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('admin.businesses.section.owner', 'Owner')}
              </Typography>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <TextField
                  label={t('admin.businesses.fields.ownerFirstName', 'Owner first name')}
                  value={form.first_name || ''}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, first_name: e.target.value }))
                  }
                />
                <TextField
                  label={t('admin.businesses.fields.ownerLastName', 'Owner last name')}
                  value={form.last_name || ''}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, last_name: e.target.value }))
                  }
                />
                <TextField
                  label={t('admin.businesses.fields.ownerPhone', 'Owner phone')}
                  value={form.phone_number || ''}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, phone_number: e.target.value }))
                  }
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingId(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleSave}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pinDialogOpen} onClose={handleCancelPinDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t('admin.businesses.withdrawalPinDialog.title', 'Set withdrawal PIN')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'admin.businesses.withdrawalPinDialog.body',
              'Enter a 4-digit PIN. Business withdrawals will require this PIN.'
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {t('admin.businesses.withdrawalPinDialog.pinLabel', 'PIN (4 digits)')}
          </Typography>
          <PinCodeFields value={pinDraft} onChange={setPinDraft} length={4} autoFocus />
          {pinDialogError ? (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {pinDialogError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelPinDialog}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleConfirmPinDialog} disabled={pinDraft.length !== 4}>
            {t('admin.businesses.withdrawalPinDialog.setPin', 'Set PIN')}
          </Button>
        </DialogActions>
      </Dialog>

      <AdminBusinessVerificationDialog
        open={!!verificationBusinessId}
        businessId={verificationBusinessId}
        businessName={verificationBusiness?.name}
        ownerName={
          verificationBusiness
            ? `${verificationBusiness.user.first_name} ${verificationBusiness.user.last_name}`
            : undefined
        }
        onClose={() => setVerificationBusinessId(null)}
        onUpdated={fetchBusinesses}
      />
    </Box>
  );
};

export default AdminManageBusinesses;
