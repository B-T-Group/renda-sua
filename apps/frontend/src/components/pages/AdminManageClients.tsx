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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminClients } from '../../hooks/useAdminClients';
import AdminUserCard from '../common/AdminUserCard';

const AdminManageClients: React.FC = () => {
  const {
    clients,
    total,
    page,
    limit,
    search,
    setPage,
    setLimit,
    setSearch,
    loading,
    error,
    fetchClients,
    updateClient,
  } = useAdminClients();
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const current = useMemo(
    () => clients.find((c) => c.id === editingId),
    [clients, editingId]
  );

  const openEdit = (id: string) => {
    const target = clients.find((c) => c.id === id);
    setForm({
      first_name: target?.user.first_name || '',
      last_name: target?.user.last_name || '',
      phone_number: target?.user.phone_number || '',
    });
    setEditingId(id);
  };

  const handleSave = async () => {
    if (!editingId) return;
    await updateClient(editingId, form);
    setEditingId(null);
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
          {t('admin.manageClients', 'Manage Clients')}
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
            <InputLabel id="clients-page-size">
              {t('common.pageSize', 'Page size')}
            </InputLabel>
            <Select
              labelId="clients-page-size"
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
            onClick={fetchClients}
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
              {clients.map((c) => (
                <AdminUserCard
                  key={c.id}
                  title={`${c.user.first_name} ${c.user.last_name}`}
                  subtitle={c.user.email}
                  accounts={c.user.accounts}
                  addresses={c.addresses}
                  verified={undefined}
                  footer={
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<EditIcon />}
                      onClick={() => openEdit(c.id)}
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
        <DialogTitle>Edit Client</DialogTitle>
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingId(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminManageClients;
