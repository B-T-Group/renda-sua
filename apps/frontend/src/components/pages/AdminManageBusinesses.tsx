import { Edit as EditIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminBusinesses } from '../../hooks/useAdminBusinesses';
import AdminUserCard from '../common/AdminUserCard';
import { PinCodeFields } from '../common/PinCodeFields';

const AdminManageBusinesses: React.FC = () => {
  const {
    businesses,
    total,
    page,
    limit,
    search,
    setPage,
    setLimit,
    setSearch,
    loading,
    error,
    fetchBusinesses,
    updateBusiness,
    setWithdrawalPin,
    clearWithdrawalPin,
  } = useAdminBusinesses();
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [withdrawalPin, setWithdrawalPinInput] = useState('');
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [pinDialogError, setPinDialogError] = useState<string | null>(null);

  const current = useMemo(
    () => businesses.find((b) => b.id === editingId),
    [businesses, editingId]
  );

  const openEdit = (id: string) => {
    const target = businesses.find((b) => b.id === id);
    setForm({
      first_name: target?.user.first_name || '',
      last_name: target?.user.last_name || '',
      phone_number: target?.user.phone_number || '',
      name: target?.name || '',
      is_admin: target?.is_admin || false,
      image_cleanup_enabled: target?.image_cleanup_enabled ?? false,
      withdrawal_pin_enabled: target?.withdrawal_pin_enabled ?? false,
    });
    setWithdrawalPinInput('');
    setPinDialogOpen(false);
    setPinDraft('');
    setPinDialogError(null);
    setEditingId(id);
  };

  const handleSave = async () => {
    if (!editingId) return;
    await updateBusiness(editingId, form);
    setEditingId(null);
  };

  const handleSetPin = async () => {
    if (!editingId) return;
    await setWithdrawalPin(editingId, withdrawalPin);
    setWithdrawalPinInput('');
  };

  const handleClearPin = async () => {
    if (!editingId) return;
    await clearWithdrawalPin(editingId);
    setWithdrawalPinInput('');
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
        <Typography variant="h5">
          {t('admin.manageBusinesses', 'Manage Businesses')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            label={t('common.search', 'Search')}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="businesses-page-size">
              {t('common.pageSize', 'Page size')}
            </InputLabel>
            <Select
              labelId="businesses-page-size"
              label={t('common.pageSize', 'Page size')}
              value={String(limit)}
              onChange={(e) => {
                setPage(1);
                setLimit(Number(e.target.value));
              }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<RefreshIcon />}
            variant="outlined"
            onClick={fetchBusinesses}
          >
            {t('common.refresh', 'Refresh')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {businesses.map((b) => (
                <AdminUserCard
                  key={b.id}
                  title={b.name}
                  subtitle={`Owner: ${b.user.first_name} ${
                    b.user.last_name
                  } • Admin: ${b.is_admin ? 'Yes' : 'No'}`}
                  accounts={(b.user as any).accounts}
                  addresses={(b as any).addresses}
                  admin={!!b.is_admin}
                  userId={b.user.id}
                  userType="business"
                  footer={
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<EditIcon />}
                      onClick={() => openEdit(b.id)}
                    >
                      Edit
                    </Button>
                  }
                />
              ))}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('common.results', '{{count}} results', { count: total })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {t('common.prev', 'Prev')}
                  </Button>
                  <Typography variant="body2">
                    {t('common.page', 'Page')} {page} /{' '}
                    {Math.max(1, Math.ceil((total || 0) / (limit || 1)))}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={
                      page >=
                      Math.max(1, Math.ceil((total || 0) / (limit || 1)))
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    {t('common.next', 'Next')}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600}>
                      {t('admin.businesses.flags.admin', 'Admin')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.businesses.flags.adminHelp',
                        'Marks the business as an admin business account.'
                      )}
                    </Typography>
                  </Box>
                  <Switch
                    checked={!!form.is_admin}
                    onChange={(e) =>
                      setForm((f: any) => ({ ...f, is_admin: e.target.checked }))
                    }
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600}>
                      {t(
                        'admin.businesses.imageCleanupEnabled',
                        'Image cleanup enabled'
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.businesses.imageCleanupEnabledHelp',
                        'Automatically removes unused images to save storage.'
                      )}
                    </Typography>
                  </Box>
                  <Switch
                    checked={!!form.image_cleanup_enabled}
                    onChange={(e) =>
                      setForm((f: any) => ({
                        ...f,
                        image_cleanup_enabled: e.target.checked,
                      }))
                    }
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
    </Box>
  );
};

export default AdminManageBusinesses;
