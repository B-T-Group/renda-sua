import { Edit as EditIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Container,
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
    <Container maxWidth="lg" sx={{ py: 2, px: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {t('admin.manageClients', 'Manage Clients')}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            width: { xs: '100%', sm: 'auto' },
            minWidth: { sm: 0 },
          }}
        >
          <TextField
            size="small"
            label={t('common.search', 'Search')}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            sx={{ minWidth: { sm: 200 } }}
          />
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
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

      <Card sx={{ overflow: 'hidden' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
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
                  userId={c.user.id}
                  userType="client"
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
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  gap: 1.5,
                  pt: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('common.results', '{{count}} results', { count: total })}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    justifyContent: { xs: 'space-between', sm: 'flex-end' },
                  }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {t('common.prev', 'Prev')}
                  </Button>
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
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
        PaperProps={{
          sx: {
            m: { xs: 2, sm: 3 },
            maxHeight: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 48px)' },
          },
        }}
      >
        <DialogTitle>Edit Client</DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
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
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button onClick={() => setEditingId(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminManageClients;
