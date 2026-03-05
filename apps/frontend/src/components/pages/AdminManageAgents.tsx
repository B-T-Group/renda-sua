import {
  Download as DownloadIcon,
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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useAdminAgents } from '../../hooks/useAdminAgents';
import { useVehicleTypes } from '../../hooks/useVehicleTypes';
import { AdminMessagePost } from '../common/AdminMessagePost';
import AdminUserCard from '../common/AdminUserCard';

export interface AgentIdDocument {
  id: string;
  file_name: string;
  content_type: string;
  document_type: { id: number; name: string; description: string };
  is_approved: boolean;
  created_at: string;
}

const AdminManageAgents: React.FC = () => {
  const {
    agents,
    total,
    page,
    limit,
    search,
    setPage,
    setLimit,
    setSearch,
    loading,
    error,
    fetchAgents,
    updateAgent,
    setAgentInternal,
  } = useAdminAgents();
  const { vehicleTypes } = useVehicleTypes();
  const apiClient = useApiClient();
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [verificationAgentId, setVerificationAgentId] = useState<string | null>(
    null
  );
  const [idDocuments, setIdDocuments] = useState<AgentIdDocument[]>([]);
  const [idDocumentsLoading, setIdDocumentsLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const verificationAgent = agents.find((a) => a.id === verificationAgentId);

  const fetchIdDocuments = useCallback(
    async (agentId: string) => {
      if (!apiClient) return;
      setIdDocumentsLoading(true);
      try {
        const { data } = await apiClient.get<{
          success: boolean;
          uploads: AgentIdDocument[];
        }>(`/admin/agents/${agentId}/id-documents`);
        setIdDocuments(data.success ? data.uploads || [] : []);
      } catch {
        setIdDocuments([]);
      } finally {
        setIdDocumentsLoading(false);
      }
    },
    [apiClient]
  );

  useEffect(() => {
    if (verificationAgentId) {
      fetchIdDocuments(verificationAgentId);
    } else {
      setIdDocuments([]);
    }
  }, [verificationAgentId, fetchIdDocuments]);

  const handleViewUpload = useCallback(
    async (uploadId: string) => {
      if (!apiClient) return;
      try {
        const { data } = await apiClient.get<{
          success: boolean;
          presigned_url?: string;
        }>(`/uploads/${uploadId}/view`);
        if (data.success && data.presigned_url) {
          window.open(data.presigned_url, '_blank');
        }
      } catch (err) {
        console.error('Failed to get view URL:', err);
      }
    },
    [apiClient]
  );

  const handleDownloadUpload = useCallback(
    async (uploadId: string, fileName: string) => {
      if (!apiClient) return;
      try {
        const { data } = await apiClient.get<{
          success: boolean;
          presigned_url?: string;
        }>(`/uploads/${uploadId}/view`);
        if (data.success && data.presigned_url) {
          const link = document.createElement('a');
          link.href = data.presigned_url!;
          link.download = fileName || 'document';
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (err) {
        console.error('Failed to get download URL:', err);
      }
    },
    [apiClient]
  );

  const handleSetVerified = useCallback(async () => {
    if (!verificationAgentId) return;
    setVerifyLoading(true);
    try {
      await updateAgent(verificationAgentId, { is_verified: true });
      setVerificationAgentId(null);
      await fetchAgents();
    } finally {
      setVerifyLoading(false);
    }
  }, [verificationAgentId, updateAgent, fetchAgents]);

  const openEdit = (id: string) => {
    const target = agents.find((a) => a.id === id);
    setForm({
      first_name: target?.user.first_name || '',
      last_name: target?.user.last_name || '',
      phone_number: target?.user.phone_number || '',
      is_verified: target?.is_verified || false,
      vehicle_type_id: target?.vehicle_type_id || 'other',
      is_internal: target?.is_internal || false,
    });
    setEditingId(id);
  };

  const handleSave = async () => {
    if (!editingId) return;
    const original = agents.find((a) => a.id === editingId);
    try {
      await updateAgent(editingId, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number,
        is_verified: form.is_verified,
        vehicle_type_id: form.vehicle_type_id,
      });

      if (
        original &&
        typeof form.is_internal === 'boolean' &&
        form.is_internal !== !!original.is_internal
      ) {
        await setAgentInternal(editingId, !!form.is_internal);
      }

      setEditingId(null);
    } catch {
      // Errors are handled by useApiWithLoading (toasts); keep dialog open
    }
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
          {t('admin.manageAgents', 'Manage Agents')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <AdminMessagePost />
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
            <InputLabel id="agents-page-size">
              {t('common.pageSize', 'Page size')}
            </InputLabel>
            <Select
              labelId="agents-page-size"
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
            onClick={fetchAgents}
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
              {agents.map((a) => (
                <AdminUserCard
                  key={a.id}
                  title={`${a.user.first_name} ${a.user.last_name}${
                    a.is_internal ? ' (Internal)' : ''
                  }`}
                  subtitle={`${a.user.email} • Vehicle: ${
                    a.vehicle_type_id
                  } • Verified: ${a.is_verified ? 'Yes' : 'No'}${
                    a.is_internal ? ' • Internal agent' : ''
                  }`}
                  accounts={(a.user as any).accounts}
                  addresses={(a as any).addresses}
                  verified={!!a.is_verified}
                  userId={a.user.id}
                  userType="agent"
                  footer={
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={() => openEdit(a.id)}
                      >
                        {t('common.edit', 'Edit')}
                      </Button>
                      {!a.is_verified && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<VerifiedUserIcon />}
                          onClick={() => setVerificationAgentId(a.id)}
                        >
                          {t('admin.agents.verification', 'Verification')}
                        </Button>
                      )}
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
        <DialogTitle>Edit Agent</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="First Name"
              value={form.first_name || ''}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, first_name: e.target.value }))
              }
            />
            <TextField
              label="Last Name"
              value={form.last_name || ''}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, last_name: e.target.value }))
              }
            />
            <TextField
              label="Phone"
              value={form.phone_number || ''}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, phone_number: e.target.value }))
              }
            />
            <FormControl fullWidth>
              <InputLabel id="vehicle-type-label">Vehicle Type</InputLabel>
              <Select
                labelId="vehicle-type-label"
                label="Vehicle Type"
                value={form.vehicle_type_id || 'other'}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    vehicle_type_id: e.target.value,
                  }))
                }
              >
                {vehicleTypes.map((vt) => (
                  <MenuItem key={vt.id} value={vt.id}>
                    {vt.comment || vt.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={!!form.is_verified}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, is_verified: e.target.checked }))
                }
              />
              <Typography>Verified</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={!!form.is_internal}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    is_internal: e.target.checked,
                  }))
                }
                disabled={!form.is_verified}
              />
              <Typography>
                Internal (Rendasua agent)
                {!form.is_verified ? ' - verify first' : ''}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingId(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!verificationAgentId}
        onClose={() => setVerificationAgentId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('admin.agents.verificationTitle', 'Agent Verification')}
          {verificationAgent && (
            <Typography variant="body2" color="text.secondary" fontWeight="normal">
              {verificationAgent.user.first_name} {verificationAgent.user.last_name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {idDocumentsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : idDocuments.length === 0 ? (
            <Alert severity="info">
              {t(
                'admin.agents.noIdDocument',
                'No ID document uploaded. Ask the agent to upload a driver\'s license, passport, or national ID from their Documents.'
              )}
            </Alert>
          ) : (
            <Box sx={{ pt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {t('admin.agents.idDocumentsList', 'ID documents (view and verify, then set as verified below)')}
              </Typography>
              <List dense>
                {idDocuments.map((doc) => (
                  <ListItem key={doc.id}>
                    <ListItemText
                      primary={doc.file_name}
                      secondary={`${doc.document_type?.description || doc.document_type?.name} • ${doc.is_approved ? t('admin.uploads.approved', 'Approved') : t('admin.uploads.pending', 'Pending')}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleViewUpload(doc.id)}
                      >
                        {t('common.view', 'View')}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadUpload(doc.id, doc.file_name)}
                      >
                        {t('common.download', 'Download')}
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationAgentId(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          {idDocuments.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              disabled={verifyLoading}
              startIcon={verifyLoading ? <CircularProgress size={20} /> : <VerifiedUserIcon />}
              onClick={handleSetVerified}
            >
              {verifyLoading
                ? t('admin.agents.verifying', 'Verifying...')
                : t('admin.agents.setAsVerified', 'Set as verified')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminManageAgents;
