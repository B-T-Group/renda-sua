import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
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
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brand,
  CreateBrandDto,
  UpdateBrandDto,
  useBrands,
} from '../../hooks/useBrands';

const BrandsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    brands,
    loading: brandsLoading,
    error: brandsError,
    createBrand,
    updateBrand,
    deleteBrand,
  } = useBrands(searchTerm);

  const handleCreateBrand = async () => {
    if (!formData.name.trim()) {
      setError('Brand name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const brandData: CreateBrandDto = {
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      const response = await createBrand(brandData);
      if (response.success) {
        setSuccess('Brand created successfully');
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '' });
      } else {
        setError(response.message || 'Failed to create brand');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create brand');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBrand = async () => {
    if (!selectedBrand || !formData.name.trim()) {
      setError('Brand name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const brandData: UpdateBrandDto = {
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      const response = await updateBrand(selectedBrand.id, brandData);
      if (response.success) {
        setSuccess('Brand updated successfully');
        setIsEditDialogOpen(false);
        setSelectedBrand(null);
        setFormData({ name: '', description: '' });
      } else {
        setError(response.message || 'Failed to update brand');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update brand');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!selectedBrand) return;

    setLoading(true);
    setError(null);
    try {
      const response = await deleteBrand(selectedBrand.id);
      if (response.success) {
        setSuccess('Brand deleted successfully');
        setIsDeleteDialogOpen(false);
        setSelectedBrand(null);
      } else {
        setError(response.message || 'Failed to delete brand');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete brand');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (brand: Brand) => {
    setSelectedBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (brand: Brand) => {
    setSelectedBrand(brand);
    setIsDeleteDialogOpen(true);
  };

  const closeDialogs = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setSelectedBrand(null);
    setFormData({ name: '', description: '' });
    setError(null);
    setSuccess(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/app')}
            sx={{ minWidth: 'auto' }}
          >
            Back to Dashboard
          </Button>
          <Typography variant="h4" component="h1">
            Brands Management
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          Add Brand
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {brandsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : brandsError ? (
            <Alert severity="error">{brandsError}</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Items Count</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {brands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {brand.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {brand.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={brand.items_aggregate?.aggregate.count || 0}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(brand.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(brand)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => openDeleteDialog(brand)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Brand Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={closeDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Brand</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Brand Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              margin="normal"
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs}>Cancel</Button>
          <Button
            onClick={handleCreateBrand}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Brand Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={closeDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Brand</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Brand Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              margin="normal"
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs}>Cancel</Button>
          <Button
            onClick={handleUpdateBrand}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Brand Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={closeDialogs}>
        <DialogTitle>Delete Brand</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the brand "{selectedBrand?.name}"?
            {selectedBrand?.items_aggregate?.aggregate.count &&
              selectedBrand.items_aggregate.aggregate.count > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This brand has {selectedBrand.items_aggregate.aggregate.count}{' '}
                  associated items. Deleting it may affect those items.
                </Alert>
              )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs}>Cancel</Button>
          <Button
            onClick={handleDeleteBrand}
            variant="contained"
            color="error"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BrandsManagementPage;
