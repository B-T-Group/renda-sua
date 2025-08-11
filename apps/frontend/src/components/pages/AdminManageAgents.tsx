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
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useAdminAgents } from '../../hooks/useAdminAgents';
import { useVehicleTypes } from '../../hooks/useVehicleTypes';

const AdminManageAgents: React.FC = () => {
  const { agents, loading, error, fetchAgents, updateAgent } = useAdminAgents();
  const { vehicleTypes } = useVehicleTypes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const current = useMemo(
    () => agents.find((a) => a.id === editingId),
    [agents, editingId]
  );

  const openEdit = (id: string) => {
    const target = agents.find((a) => a.id === id);
    setForm({
      first_name: target?.user.first_name || '',
      last_name: target?.user.last_name || '',
      phone_number: target?.user.phone_number || '',
      is_verified: target?.is_verified || false,
      vehicle_type_id: target?.vehicle_type_id || 'other',
    });
    setEditingId(id);
  };

  const handleSave = async () => {
    if (!editingId) return;
    await updateAgent(editingId, form);
    setEditingId(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Manage Agents</Typography>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={fetchAgents}
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 2,
              }}
            >
              {agents.map((a) => (
                <Card key={a.id} sx={{ p: 2 }}>
                  <Typography variant="h6">
                    {a.user.first_name} {a.user.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {a.user.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vehicle: {a.vehicle_type_id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Verified: {a.is_verified ? 'Yes' : 'No'}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<EditIcon />}
                      onClick={() => openEdit(a.id)}
                    >
                      Edit
                    </Button>
                  </Box>
                </Card>
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

export default AdminManageAgents;
