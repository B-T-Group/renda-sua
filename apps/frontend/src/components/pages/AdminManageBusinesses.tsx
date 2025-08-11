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
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useAdminBusinesses } from '../../hooks/useAdminBusinesses';
import AdminUserCard from '../common/AdminUserCard';

const AdminManageBusinesses: React.FC = () => {
  const { businesses, loading, error, fetchBusinesses, updateBusiness } =
    useAdminBusinesses();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

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
    });
    setEditingId(id);
  };

  const handleSave = async () => {
    if (!editingId) return;
    await updateBusiness(editingId, form);
    setEditingId(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Manage Businesses</Typography>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={fetchBusinesses}
        >
          Refresh
        </Button>
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
        <DialogTitle>Edit Business</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Business Name"
              value={form.name || ''}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, name: e.target.value }))
              }
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={!!form.is_admin}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, is_admin: e.target.checked }))
                }
              />
              <Typography>Admin</Typography>
            </Box>
            <TextField
              label="Owner First Name"
              value={form.first_name || ''}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, first_name: e.target.value }))
              }
            />
            <TextField
              label="Owner Last Name"
              value={form.last_name || ''}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, last_name: e.target.value }))
              }
            />
            <TextField
              label="Owner Phone"
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

export default AdminManageBusinesses;
