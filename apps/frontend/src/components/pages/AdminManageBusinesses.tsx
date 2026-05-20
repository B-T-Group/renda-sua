import {
  Block as BlockIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  VerifiedUser as VerifiedUserIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useAdminBusinesses } from '../../hooks/useAdminBusinesses';
import AdminUserCard from '../common/AdminUserCard';
import { PinCodeFields } from '../common/PinCodeFields';

interface BusinessIdDocument {
  id: string;
  file_name: string;
  is_approved: boolean;
  note?: string | null;
  document_type?: { name: string };
}

interface BusinessVerificationDetails {
  business: {
    id: string;
    name: string;
    is_verified: boolean;
    user: { first_name: string; last_name: string; email: string };
  };
  latestAcceptance: {
    signer_legal_name: string;
    agreement_version: string;
    accepted_at: string;
    pdf_upload_id?: string | null;
  } | null;
  identityDocuments: BusinessIdDocument[];
}

const AdminManageBusinesses: React.FC = () => {
  const apiClient = useApiClient();
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
  const [verificationBusinessId, setVerificationBusinessId] = useState<string | null>(null);
  const [verificationDetails, setVerificationDetails] =
    useState<BusinessVerificationDetails | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [nameMatchConfirmed, setNameMatchConfirmed] = useState(false);
  const [presignedUrlLoadingId, setPresignedUrlLoadingId] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

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
      is_verified: target?.is_verified || false,
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

  const fetchVerificationDetails = useCallback(
    async (businessId: string) => {
      if (!apiClient) return;
      setVerificationLoading(true);
      try {
        const { data } = await apiClient.get<{
          success: boolean;
          data: BusinessVerificationDetails;
        }>(`/admin/businesses/${businessId}/verification`);
        setVerificationDetails(data.success ? data.data : null);
      } catch {
        setVerificationDetails(null);
      } finally {
        setVerificationLoading(false);
      }
    },
    [apiClient]
  );

  useEffect(() => {
    if (verificationBusinessId) {
      setNameMatchConfirmed(false);
      void fetchVerificationDetails(verificationBusinessId);
    } else {
      setVerificationDetails(null);
    }
  }, [verificationBusinessId, fetchVerificationDetails]);

  const handleViewUpload = useCallback(
    async (uploadId: string) => {
      if (!apiClient) return;
      setPresignedUrlLoadingId(uploadId);
      try {
        const { data } = await apiClient.get<{
          success: boolean;
          presigned_url?: string;
        }>(`/uploads/${uploadId}/view`);
        if (data.success && data.presigned_url) {
          window.open(data.presigned_url, '_blank');
        }
      } finally {
        setPresignedUrlLoadingId(null);
      }
    },
    [apiClient]
  );

  const handleSetVerified = useCallback(async () => {
    if (!verificationBusinessId || !nameMatchConfirmed) return;
    setVerifyLoading(true);
    try {
      await updateBusiness(verificationBusinessId, { is_verified: true });
      setVerificationBusinessId(null);
    } finally {
      setVerifyLoading(false);
    }
  }, [verificationBusinessId, nameMatchConfirmed, updateBusiness]);

  const handleRejectUpload = useCallback(
    async (uploadId: string) => {
      if (!apiClient || !rejectMessage.trim() || !verificationBusinessId) return;
      setRejectLoading(true);
      try {
        await apiClient.patch(`/uploads/${uploadId}/reject`, {
          message: rejectMessage.trim(),
        });
        setRejectingDocId(null);
        setRejectMessage('');
        await fetchVerificationDetails(verificationBusinessId);
      } finally {
        setRejectLoading(false);
      }
    },
    [apiClient, rejectMessage, verificationBusinessId, fetchVerificationDetails]
  );

  const verificationBusiness = businesses.find((b) => b.id === verificationBusinessId);

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
                  } • Admin: ${b.is_admin ? 'Yes' : 'No'} • Verified: ${
                    b.is_verified ? 'Yes' : 'No'
                  }`}
                  accounts={(b.user as any).accounts}
                  addresses={(b as any).addresses}
                  admin={!!b.is_admin}
                  verified={!!b.is_verified}
                  userId={b.user.id}
                  userType="business"
                  footer={
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {!b.is_verified && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => setVerificationBusinessId(b.id)}
                        >
                          {t('admin.businesses.verification', 'Verification')}
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={() => openEdit(b.id)}
                      >
                        {t('common.edit', 'Edit')}
                      </Button>
                    </Box>
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
                      {t('admin.businesses.flags.verified', 'Verified')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.businesses.flags.verifiedHelp',
                        'Verified businesses can have catalog items visible publicly.'
                      )}
                    </Typography>
                  </Box>
                  <Switch
                    checked={!!form.is_verified}
                    onChange={(e) =>
                      setForm((f: any) => ({ ...f, is_verified: e.target.checked }))
                    }
                  />
                </Box>

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

      <Dialog
        open={!!verificationBusinessId}
        onClose={() => setVerificationBusinessId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('admin.businesses.verificationTitle', 'Business verification')}
          {verificationBusiness && (
            <Typography variant="body2" color="text.secondary" fontWeight="normal">
              {verificationBusiness.name} — {verificationBusiness.user.first_name}{' '}
              {verificationBusiness.user.last_name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {verificationLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!verificationDetails?.latestAcceptance ? (
                <Alert severity="warning">
                  {t(
                    'admin.businesses.noAgreement',
                    'No merchant agreement on file. Ask the business to sign the agreement in the app.'
                  )}
                </Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('admin.businesses.merchantAgreement', 'Merchant agreement')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('admin.businesses.signerName', 'Signer')}:{' '}
                    {verificationDetails.latestAcceptance.signer_legal_name} (
                    {verificationDetails.latestAcceptance.agreement_version})
                  </Typography>
                  {verificationDetails.latestAcceptance.pdf_upload_id && (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      startIcon={
                        presignedUrlLoadingId ===
                        verificationDetails.latestAcceptance.pdf_upload_id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <VisibilityIcon />
                        )
                      }
                      onClick={() =>
                        void handleViewUpload(
                          verificationDetails.latestAcceptance!.pdf_upload_id!
                        )
                      }
                    >
                      {t('admin.businesses.viewAgreementPdf', 'View signed PDF')}
                    </Button>
                  )}
                </Box>
              )}

              {(verificationDetails?.identityDocuments?.length ?? 0) === 0 ? (
                <Alert severity="info">
                  {t(
                    'admin.businesses.noIdDocument',
                    'No ID document uploaded. Ask the business to upload ID from Documents.'
                  )}
                </Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('admin.businesses.idDocuments', 'Identity documents')}
                  </Typography>
                  <List dense>
                    {verificationDetails!.identityDocuments.map((doc) => (
                      <ListItem key={doc.id}>
                        <ListItemText
                          primary={doc.file_name}
                          secondary={`${doc.document_type?.name ?? ''} • ${
                            doc.is_approved
                              ? t('admin.uploads.approved', 'Approved')
                              : t('admin.uploads.pending', 'Pending')
                          }`}
                        />
                        <ListItemSecondaryAction>
                          <Button
                            size="small"
                            onClick={() => void handleViewUpload(doc.id)}
                            disabled={presignedUrlLoadingId !== null}
                          >
                            {t('common.view', 'View')}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<BlockIcon />}
                            onClick={() => {
                              setRejectingDocId(doc.id);
                              setRejectMessage('');
                            }}
                          >
                            {t('admin.agents.reject', 'Reject')}
                          </Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={nameMatchConfirmed}
                    onChange={(e) => setNameMatchConfirmed(e.target.checked)}
                  />
                }
                label={t(
                  'admin.businesses.nameMatchConfirm',
                  'Legal name on ID matches account owner name'
                )}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationBusinessId(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          {(verificationDetails?.identityDocuments?.length ?? 0) > 0 &&
            verificationDetails?.latestAcceptance && (
              <Button
                variant="contained"
                disabled={!nameMatchConfirmed || verifyLoading}
                startIcon={
                  verifyLoading ? <CircularProgress size={20} /> : <VerifiedUserIcon />
                }
                onClick={() => void handleSetVerified()}
              >
                {t('admin.businesses.setAsVerified', 'Set as verified')}
              </Button>
            )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!rejectingDocId}
        onClose={() => !rejectLoading && setRejectingDocId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('admin.agents.rejectDocument', 'Reject document')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label={t('admin.agents.rejectMessage', 'Message to user')}
            value={rejectMessage}
            onChange={(e) => setRejectMessage(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectingDocId(null)} disabled={rejectLoading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!rejectMessage.trim() || rejectLoading}
            onClick={() => rejectingDocId && void handleRejectUpload(rejectingDocId)}
          >
            {t('admin.agents.reject', 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminManageBusinesses;
