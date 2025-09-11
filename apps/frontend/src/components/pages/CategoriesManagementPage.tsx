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
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Category,
  CreateCategoryDto,
  CreateSubcategoryDto,
  Subcategory,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
  useCategories,
  useSubcategories,
} from '../../hooks/useCategories';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CategoriesManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [subcategorySearchTerm, setSubcategorySearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Category dialogs
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] =
    useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] =
    useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] =
    useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  });

  // Subcategory dialogs
  const [isCreateSubcategoryDialogOpen, setIsCreateSubcategoryDialogOpen] =
    useState(false);
  const [isEditSubcategoryDialogOpen, setIsEditSubcategoryDialogOpen] =
    useState(false);
  const [isDeleteSubcategoryDialogOpen, setIsDeleteSubcategoryDialogOpen] =
    useState(false);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<Subcategory | null>(null);
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: '',
    description: '',
    item_category_id: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories(searchTerm);
  const {
    subcategories,
    loading: subcategoriesLoading,
    error: subcategoriesError,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
  } = useSubcategories(subcategorySearchTerm, selectedCategoryId);

  const handleCreateCategory = async () => {
    if (!categoryFormData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const categoryData: CreateCategoryDto = {
        name: categoryFormData.name.trim(),
        description: categoryFormData.description.trim(),
      };

      const response = await createCategory(categoryData);
      if (response.success) {
        setSuccess('Category created successfully');
        setIsCreateCategoryDialogOpen(false);
        setCategoryFormData({ name: '', description: '' });
      } else {
        setError(response.message || 'Failed to create category');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!selectedCategory || !categoryFormData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const categoryData: UpdateCategoryDto = {
        name: categoryFormData.name.trim(),
        description: categoryFormData.description.trim(),
      };

      const response = await updateCategory(
        selectedCategory.id.toString(),
        categoryData
      );
      if (response.success) {
        setSuccess('Category updated successfully');
        setIsEditCategoryDialogOpen(false);
        setSelectedCategory(null);
        setCategoryFormData({ name: '', description: '' });
      } else {
        setError(response.message || 'Failed to update category');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;

    setLoading(true);
    setError(null);
    try {
      const response = await deleteCategory(selectedCategory.id.toString());
      if (response.success) {
        setSuccess('Category deleted successfully');
        setIsDeleteCategoryDialogOpen(false);
        setSelectedCategory(null);
      } else {
        setError(response.message || 'Failed to delete category');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubcategory = async () => {
    if (!subcategoryFormData.name.trim()) {
      setError('Subcategory name is required');
      return;
    }
    if (!subcategoryFormData.item_category_id) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const subcategoryData: CreateSubcategoryDto = {
        name: subcategoryFormData.name.trim(),
        description: subcategoryFormData.description.trim(),
        item_category_id: subcategoryFormData.item_category_id,
      };

      const response = await createSubcategory(subcategoryData);
      if (response.success) {
        setSuccess('Subcategory created successfully');
        setIsCreateSubcategoryDialogOpen(false);
        setSubcategoryFormData({
          name: '',
          description: '',
          item_category_id: 0,
        });
      } else {
        setError(response.message || 'Failed to create subcategory');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create subcategory');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubcategory = async () => {
    if (!selectedSubcategory || !subcategoryFormData.name.trim()) {
      setError('Subcategory name is required');
      return;
    }
    if (!subcategoryFormData.item_category_id) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const subcategoryData: UpdateSubcategoryDto = {
        name: subcategoryFormData.name.trim(),
        description: subcategoryFormData.description.trim(),
        item_category_id: subcategoryFormData.item_category_id,
      };

      const response = await updateSubcategory(
        selectedSubcategory.id.toString(),
        subcategoryData
      );
      if (response.success) {
        setSuccess('Subcategory updated successfully');
        setIsEditSubcategoryDialogOpen(false);
        setSelectedSubcategory(null);
        setSubcategoryFormData({
          name: '',
          description: '',
          item_category_id: 0,
        });
      } else {
        setError(response.message || 'Failed to update subcategory');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update subcategory');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubcategory = async () => {
    if (!selectedSubcategory) return;

    setLoading(true);
    setError(null);
    try {
      const response = await deleteSubcategory(
        selectedSubcategory.id.toString()
      );
      if (response.success) {
        setSuccess('Subcategory deleted successfully');
        setIsDeleteSubcategoryDialogOpen(false);
        setSelectedSubcategory(null);
      } else {
        setError(response.message || 'Failed to delete subcategory');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete subcategory');
    } finally {
      setLoading(false);
    }
  };

  const openEditCategoryDialog = (category: Category) => {
    setSelectedCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description,
    });
    setIsEditCategoryDialogOpen(true);
  };

  const openDeleteCategoryDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteCategoryDialogOpen(true);
  };

  const openEditSubcategoryDialog = (subcategory: Subcategory) => {
    setSelectedSubcategory(subcategory);
    setSubcategoryFormData({
      name: subcategory.name,
      description: subcategory.description,
      item_category_id: subcategory.item_category_id,
    });
    setIsEditSubcategoryDialogOpen(true);
  };

  const openDeleteSubcategoryDialog = (subcategory: Subcategory) => {
    setSelectedSubcategory(subcategory);
    setIsDeleteSubcategoryDialogOpen(true);
  };

  const closeDialogs = () => {
    setIsCreateCategoryDialogOpen(false);
    setIsEditCategoryDialogOpen(false);
    setIsDeleteCategoryDialogOpen(false);
    setIsCreateSubcategoryDialogOpen(false);
    setIsEditSubcategoryDialogOpen(false);
    setIsDeleteSubcategoryDialogOpen(false);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setCategoryFormData({ name: '', description: '' });
    setSubcategoryFormData({ name: '', description: '', item_category_id: 0 });
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
            Categories & Subcategories Management
          </Typography>
        </Box>
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
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
          >
            <Tab label="Categories" />
            <Tab label="Subcategories" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <TextField
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateCategoryDialogOpen(true)}
            >
              Add Category
            </Button>
          </Box>

          {categoriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : categoriesError ? (
            <Alert severity="error">{categoriesError}</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Subcategories Count</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {category.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            category.item_sub_categories_aggregate?.aggregate
                              .count || 0
                          }
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(category.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => openEditCategoryDialog(category)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => openDeleteCategoryDialog(category)}
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
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Search subcategories..."
                value={subcategorySearchTerm}
                onChange={(e) => setSubcategorySearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 300 }}
              />
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Filter by Category</InputLabel>
                <Select
                  value={selectedCategoryId}
                  label="Filter by Category"
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateSubcategoryDialogOpen(true)}
            >
              Add Subcategory
            </Button>
          </Box>

          {subcategoriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : subcategoriesError ? (
            <Alert severity="error">{subcategoriesError}</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Items Count</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subcategories.map((subcategory) => (
                    <TableRow key={subcategory.id}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {subcategory.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {subcategory.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={subcategory.item_category?.name || 'Unknown'}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            subcategory.items_aggregate?.aggregate.count || 0
                          }
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(
                            subcategory.created_at
                          ).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => openEditSubcategoryDialog(subcategory)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            openDeleteSubcategoryDialog(subcategory)
                          }
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
        </TabPanel>
      </Card>

      {/* Create Category Dialog */}
      <Dialog
        open={isCreateCategoryDialogOpen}
        onClose={closeDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Category</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Category Name"
              value={categoryFormData.name}
              onChange={(e) =>
                setCategoryFormData({
                  ...categoryFormData,
                  name: e.target.value,
                })
              }
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={categoryFormData.description}
              onChange={(e) =>
                setCategoryFormData({
                  ...categoryFormData,
                  description: e.target.value,
                })
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
            onClick={handleCreateCategory}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={isEditCategoryDialogOpen}
        onClose={closeDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Category</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Category Name"
              value={categoryFormData.name}
              onChange={(e) =>
                setCategoryFormData({
                  ...categoryFormData,
                  name: e.target.value,
                })
              }
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={categoryFormData.description}
              onChange={(e) =>
                setCategoryFormData({
                  ...categoryFormData,
                  description: e.target.value,
                })
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
            onClick={handleUpdateCategory}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={isDeleteCategoryDialogOpen} onClose={closeDialogs}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the category "
            {selectedCategory?.name}"?
            {selectedCategory?.item_sub_categories_aggregate?.aggregate.count &&
              selectedCategory.item_sub_categories_aggregate.aggregate.count >
                0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This category has{' '}
                  {
                    selectedCategory.item_sub_categories_aggregate.aggregate
                      .count
                  }{' '}
                  associated subcategories. Deleting it may affect those
                  subcategories.
                </Alert>
              )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs}>Cancel</Button>
          <Button
            onClick={handleDeleteCategory}
            variant="contained"
            color="error"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Subcategory Dialog */}
      <Dialog
        open={isCreateSubcategoryDialogOpen}
        onClose={closeDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Subcategory</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Category</InputLabel>
              <Select
                value={subcategoryFormData.item_category_id}
                label="Category"
                onChange={(e) =>
                  setSubcategoryFormData({
                    ...subcategoryFormData,
                    item_category_id: Number(e.target.value),
                  })
                }
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Subcategory Name"
              value={subcategoryFormData.name}
              onChange={(e) =>
                setSubcategoryFormData({
                  ...subcategoryFormData,
                  name: e.target.value,
                })
              }
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={subcategoryFormData.description}
              onChange={(e) =>
                setSubcategoryFormData({
                  ...subcategoryFormData,
                  description: e.target.value,
                })
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
            onClick={handleCreateSubcategory}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subcategory Dialog */}
      <Dialog
        open={isEditSubcategoryDialogOpen}
        onClose={closeDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Subcategory</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Category</InputLabel>
              <Select
                value={subcategoryFormData.item_category_id}
                label="Category"
                onChange={(e) =>
                  setSubcategoryFormData({
                    ...subcategoryFormData,
                    item_category_id: Number(e.target.value),
                  })
                }
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Subcategory Name"
              value={subcategoryFormData.name}
              onChange={(e) =>
                setSubcategoryFormData({
                  ...subcategoryFormData,
                  name: e.target.value,
                })
              }
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={subcategoryFormData.description}
              onChange={(e) =>
                setSubcategoryFormData({
                  ...subcategoryFormData,
                  description: e.target.value,
                })
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
            onClick={handleUpdateSubcategory}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Subcategory Dialog */}
      <Dialog open={isDeleteSubcategoryDialogOpen} onClose={closeDialogs}>
        <DialogTitle>Delete Subcategory</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the subcategory "
            {selectedSubcategory?.name}"?
            {selectedSubcategory?.items_aggregate?.aggregate.count &&
              selectedSubcategory.items_aggregate.aggregate.count > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This subcategory has{' '}
                  {selectedSubcategory.items_aggregate.aggregate.count}{' '}
                  associated items. Deleting it may affect those items.
                </Alert>
              )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs}>Cancel</Button>
          <Button
            onClick={handleDeleteSubcategory}
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

export default CategoriesManagementPage;
